import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from '../src/mock.js';
import { validateDocument } from '../src/validate.js';

const text = (value) => ({ value });
const paragraph = (...lines) => ({ textList: lines.map(text) });
const image = (id, w, h) => ({
  uploadDestinationId: id,
  altText: 'alt',
  imageCropSpecification: {
    size: { width: { value: w, units: 'pixels' }, height: { value: h, units: 'pixels' } },
    offset: { x: { value: 0, units: 'pixels' }, y: { value: 0, units: 'pixels' } },
  },
});
const spec = (k, v) => ({ techSpec: { specKey: text(k), specValue: text(v) } });

const premium = () => ({
  name: 'Test Premium',
  contentType: 'EBC',
  locale: 'en-US',
  contentModuleList: [
    {
      contentModuleType: 'PREMIUM_IMAGE_TEXT',
      premiumImageText: {
        positionType: 'LEFT',
        headline: text('Headline'),
        bodyText: paragraph('Body'),
        image: image('aplus-media/sc/x.png', 1464, 600),
      },
    },
    {
      contentModuleType: 'PREMIUM_TECH_SPECS',
      premiumTechSpecs: {
        headline: text('Specs'),
        columnCount: 2,
        techSpecs: [spec('a', '1'), spec('b', '2'), spec('c', '3'), spec('d', '4')],
      },
    },
  ],
});

before(() => mock.reset());
after(() => mock.reset());

test('validator: clean Premium document has no errors', () => {
  assert.deepEqual(validateDocument(premium()), []);
});

test('validator: reports the same constraint strings as the API', () => {
  const doc = premium();
  doc.locale = 'en_US';
  doc.contentModuleList[1].premiumTechSpecs.headline = undefined;
  doc.contentModuleList[1].premiumTechSpecs.techSpecs = [{ specKey: text('flat'), specValue: text('item') }];
  const details = validateDocument(doc).map((e) => e.details);
  assert.ok(details.some((d) => d.endsWith('contentDocument.locale: must match "^[a-z]{2,}-[A-Z0-9]{2,}$"')));
  assert.ok(details.some((d) => d.endsWith('contentModuleList[1].premiumTechSpecs.headline: must not be null')));
  assert.ok(details.some((d) => d.endsWith('premiumTechSpecs.techSpecs[0].techSpec: must not be null')));
});

test('validator: document-level rules (single error, after field checks)', () => {
  // STANDARD_* + PREMIUM_* in one document
  const mixed = premium();
  mixed.contentModuleList.push({ contentModuleType: 'STANDARD_TEXT', standardText: { body: paragraph('x') } });
  assert.deepEqual(
    validateDocument(mixed).map((e) => e.details),
    ['Content documents cannot contain both premium and standard module types.'],
  );
  // validate/create/update cap only lists holding a Premium module: 8 Standard modules pass (their limit applies at submission)
  const standard8 = {
    name: 'Standard 8',
    contentType: 'EBC',
    locale: 'en-US',
    contentModuleList: Array.from({ length: 8 }, (_, i) => ({
      contentModuleType: 'STANDARD_TEXT',
      standardText: { headline: text(`Section ${i}`), body: paragraph(`Body ${i}.`) },
    })),
  };
  assert.deepEqual(validateDocument(standard8), []);
  // Brand Story modules are neither Standard nor Premium: the API validator lets them through next to either tier
  const withAbout = premium();
  withAbout.contentModuleList.push({
    contentModuleType: 'BRAND_STORY_ABOUT',
    brandStoryAbout: {
      logoImage: image('l', 362, 453),
      title: text('About us'),
      slogan: paragraph('Made by a small studio.'),
    },
  });
  assert.deepEqual(validateDocument(withAbout), []);
  // field errors are reported first, the tier rule only once they are fixed
  const both = premium();
  both.contentModuleList[1].premiumTechSpecs.headline = undefined;
  both.contentModuleList.push({ contentModuleType: 'STANDARD_TEXT', standardText: { body: paragraph('x') } });
  const first = validateDocument(both).map((e) => e.details);
  assert.ok(first.some((d) => d.endsWith('premiumTechSpecs.headline: must not be null')));
  assert.ok(!first.includes('Content documents cannot contain both premium and standard module types.'));
});

test('validator: image crop below the module minimum, paragraph limits', () => {
  const doc = premium();
  doc.contentModuleList[0].premiumImageText.image = image('x', 800, 300);
  doc.contentModuleList[0].premiumImageText.bodyText = paragraph('a', 'b', 'c', 'd', 'e', 'f');
  const details = validateDocument(doc).map((e) => e.details);
  assert.ok(
    details.some((d) =>
      d.endsWith('image.imageCropSpecification.size.height.value: must be greater than or equal to 600'),
    ),
  );
  assert.ok(
    details.some((d) =>
      d.endsWith('image.imageCropSpecification.size.width.value: must be greater than or equal to 1464'),
    ),
  );
  assert.ok(details.some((d) => d.endsWith('bodyText.textList: Total text items 6 exceeds maximum of 5')));
});

test('validator: plain string bounds from the model (comparison table title 80, metric value 250)', () => {
  const doc = premium();
  doc.contentModuleList = [
    {
      contentModuleType: 'STANDARD_COMPARISON_TABLE',
      standardComparisonTable: {
        productColumns: [
          { position: 1, image: image('x', 300, 300), title: 'T'.repeat(81), metrics: [{ position: 1, value: 'ok' }] },
          {
            position: 2,
            image: image('y', 300, 300),
            title: 'Fine',
            metrics: [{ position: 1, value: 'v'.repeat(251) }],
          },
        ],
        metricRowLabels: [{ position: 1, value: 'Label' }],
      },
    },
  ];
  const details = validateDocument(doc).map((e) => e.details);
  assert.ok(details.some((d) => d.endsWith('productColumns[0].title: length must be between 1 and 80')));
  assert.ok(details.some((d) => d.endsWith('productColumns[1].metrics[0].value: length must be between 1 and 250')));
  assert.ok(!details.some((d) => d.includes('productColumns[1].title')));
});

test('validator: module cap, hotspot pixel bounds, button text length', () => {
  const capped = premium();
  while (capped.contentModuleList.length < 8)
    capped.contentModuleList.push(structuredClone(premium().contentModuleList[0]));
  assert.deepEqual(
    validateDocument(capped).map((e) => e.details),
    ['Content module lists cannot have more than 7 modules.'],
  );

  const hotspot = (x, y) => ({
    imageTextHotSpot: {
      title: text('t'),
      xCoordinate: text(String(x)),
      yCoordinate: text(String(y)),
      mobileImage: image('m', 600, 450),
    },
  });
  const doc = premium();
  doc.contentModuleList.push({
    contentModuleType: 'PREMIUM_HOTSPOT_IMAGE_TEXT',
    premiumHotspotImageText: {
      headline: text('Anatomy'),
      desktopImage: image('d', 1464, 600),
      hotSpots: [hotspot(10, 10), hotspot(400, 300), hotspot(460, 300), hotspot(800, 300)],
    },
  });
  doc.contentModuleList.push({
    contentModuleType: 'PREMIUM_IMAGE_CAROUSEL',
    premiumImageCarousel: {
      headline: text('h'),
      carouselCards: [
        {
          imagePanel: {
            position: 1,
            title: text('t'),
            buttonText: text('Shop this tee now'),
            asin: text('B0SAMPLE01'),
            desktopImage: image('d', 1464, 600),
            mobileImage: image('m', 600, 450),
          },
        },
        {
          imagePanel: {
            position: 2,
            title: text('t'),
            desktopImage: image('d', 1464, 600),
            mobileImage: image('m', 600, 450),
          },
        },
      ],
    },
  });
  const details = validateDocument(doc).map((e) => e.details);
  assert.ok(
    details.some((d) => d.endsWith('premiumHotspotImageText.hotSpots[0]: hotspot placement out of bounds')),
    'edge margin',
  );
  assert.ok(
    details.some((d) => d.endsWith('premiumHotspotImageText.hotSpots[2]: overlaps with hotspot at index 1')),
    'overlap (60 px apart)',
  );
  assert.ok(!details.some((d) => d.includes('hotSpots[3]')), 'a marker well inside the image passes');
  assert.ok(
    details.some((d) => d.endsWith('carouselCards[0].imagePanel.buttonText.value: length must be between 0 and 12')),
    'button text',
  );
  // positions are unique per list, not per module: the two cards above have 1 and 2, no duplicate
  assert.ok(!details.some((d) => d.startsWith('Duplicate position')));
});

test('mock: full flow, permissive relations, 403 on ineligible ASIN, last approved doc owns the publish record', () => {
  const created = mock.createContentDocument(premium());
  assert.equal(created.status, 200);
  const crk = created.body.contentReferenceKey;

  assert.equal(mock.postAsinRelations(crk, ['B0SAMPLE01', 'B0SAMPLE99']).status, 200);
  const rel = mock.listAsinRelations(crk).body;
  assert.equal(rel.warnings[0].code, 'ASIN_FAILED_VALIDATION');
  assert.deepEqual(rel.asinMetadataSet[1].badgeSet, ['CONTENT_NOT_PUBLISHED', 'BRAND_NOT_ELIGIBLE']);

  const denied = mock.submit(crk);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.errors[1].message, 'Failed asin permissions check.');

  mock.postAsinRelations(crk, ['B0SAMPLE01']);
  assert.equal(mock.submit(crk).status, 200);
  assert.equal(mock.getContentDocument(crk, ['METADATA']).body.contentRecord.contentMetadata.status, 'APPROVED');
  assert.equal(
    mock.publishRecords('B0SAMPLE01').body.publishRecordList.find((r) => r.contentType === 'EBC').contentReferenceKey,
    crk,
  );
  assert.deepEqual(mock.listAsinRelations(mock.fixtureKeys.premium).body.asinMetadataSet[0].badgeSet, [
    'CONTENT_NOT_PUBLISHED',
  ]);

  // any relations call on an APPROVED document resets it to DRAFT
  mock.postAsinRelations(crk, ['B0SAMPLE01']);
  assert.equal(mock.getContentDocument(crk, ['METADATA']).body.contentRecord.contentMetadata.status, 'DRAFT');
});

test('mock: Standard document over seven modules saves but is refused at submission', () => {
  const standardText = (i) => ({ contentModuleType: 'STANDARD_TEXT', standardText: { body: paragraph(`Block ${i}`) } });
  const doc = { name: 'Eight Standard', contentType: 'EBC', locale: 'en-US', contentModuleList: [] };
  for (let i = 1; i <= 8; i++) doc.contentModuleList.push(standardText(i));
  // validate / create accept a Standard list of any length (only a list holding a Premium module is capped there)
  assert.deepEqual(validateDocument(doc), []);
  const created = mock.createContentDocument(doc);
  assert.equal(created.status, 200);
  const crk = created.body.contentReferenceKey;
  mock.postAsinRelations(crk, ['B0SAMPLE01']);
  const refused = mock.submit(crk);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.errors[0].message, 'This A+ content type cannot have more than 7 modules.');
  assert.equal(mock.getContentDocument(crk, ['METADATA']).body.contentRecord.contentMetadata.status, 'DRAFT');
  // seven is fine
  doc.contentModuleList.pop();
  assert.equal(mock.updateContentDocument(crk, doc).status, 200);
  assert.equal(mock.submit(crk).status, 200);
});

test('mock: Brand Story refused at create without Brand Registry, validation passes first', () => {
  const doc = {
    name: 'BS',
    contentType: 'BrandStory',
    locale: 'en-US',
    contentModuleList: [
      { contentModuleType: 'BRAND_STORY_ABOUT', brandStoryAbout: { logoImage: image('x', 362, 453) } },
    ],
  };
  assert.equal(mock.validate(doc, ['B0SAMPLE01']).status, 200);
  mock.configure({ brandRegistry: 'not_enrolled' });
  const r = mock.createContentDocument(doc);
  assert.equal(r.status, 400);
  assert.match(r.body.errors[0].message, /shouldn't be using project type: \[BrandStory\]/);
  mock.configure({ brandRegistry: 'enrolled' });
  assert.equal(mock.createContentDocument(doc).status, 200);
});

test('mock: fixture documents are seeded and an ASIN carries one EBC and one Brand Story publish record', () => {
  mock.reset();
  const recs = mock.publishRecords('B0SAMPLE01').body.publishRecordList;
  assert.deepEqual(recs.map((r) => r.contentType).sort(), ['BrandStory', 'EBC']);
  assert.equal(recs.find((r) => r.contentType === 'EBC').contentReferenceKey, mock.fixtureKeys.premium);
  assert.equal(recs.find((r) => r.contentType === 'BrandStory').contentReferenceKey, mock.fixtureKeys.brandstory);
  const premium = mock.getContentDocument(mock.fixtureKeys.premium, ['CONTENTS', 'METADATA']).body.contentRecord;
  assert.equal(premium.contentMetadata.status, 'APPROVED');
  assert.ok(premium.contentDocument.contentModuleList.length >= 7);
  // approving the Standard fixture takes over the EBC record but leaves the Brand Story record alone
  mock.postAsinRelations(mock.fixtureKeys.standard, ['B0SAMPLE01']);
  assert.equal(mock.submit(mock.fixtureKeys.standard).status, 200);
  const after = mock.publishRecords('B0SAMPLE01').body.publishRecordList;
  assert.equal(after.find((r) => r.contentType === 'EBC').contentReferenceKey, mock.fixtureKeys.standard);
  assert.equal(after.find((r) => r.contentType === 'BrandStory').contentReferenceKey, mock.fixtureKeys.brandstory);
  // fixture images are served through the uploads lookup
  const img = premium.contentDocument.contentModuleList[0].premiumFullBackgroundImage.desktopImage.uploadDestinationId;
  assert.ok(mock.uploadedImage(img)?.bytes.length > 1000);
  mock.reset();
});

test('mock: upload destination keeps bytes for the preview', () => {
  const r = mock.createUploadDestination('a.png', 'image/png', Buffer.from([1, 2, 3]));
  assert.equal(r.status, 201);
  assert.deepEqual([...mock.uploadedImage(r.body.payload.uploadDestinationId).bytes], [1, 2, 3]);
});

test('mock: unknown key returns the two NOT_FOUND entries', () => {
  const r = mock.getContentDocument('00000000-0000-0000-0000-000000000000', ['METADATA']);
  assert.equal(r.status, 404);
  assert.equal(r.body.errors.length, 2);
});
