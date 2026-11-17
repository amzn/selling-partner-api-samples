// Structural validation for the mock, producing the same `InvalidInput` details strings the API
// returns ("Request failed validation: validateContentDocumentAsinRelations.postContentDocumentRequest.<path>: <constraint>").
// Driven by shared/module-catalog.json (generated from the OpenAPI model), so required fields,
// wrapper keys, array bounds and enums follow the contract without hand-maintained rules.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(here, '..', '..', 'shared', 'module-catalog.json'), 'utf8'));
const byType = Object.fromEntries(catalog.modules.map((m) => [m.type, m]));

const PREFIX =
  'Request failed validation: validateContentDocumentAsinRelations.postContentDocumentRequest.contentDocument';
const MESSAGE = 'The request is not valid, please check the inputs and try again.';
// Text limits are module-specific in the service; these are the ones the API enforces or documents.
const TEXT_MAX = {
  headline: 160,
  subheadline: 100,
  title: 160,
  specKey: 60,
  specValue: 500,
  label: 30,
  description: 500,
  question: 160,
  value: 500,
  buttonText: 12,
};
const PARAGRAPH_MAX = { items: 5, total: 500 };
// A module list holding a PREMIUM_* module is capped at 7 by validate/create/update ("Content module lists cannot have
// more than 7 modules."). Standard-only documents pass those operations at any length; their module limit is applied
// when the document is submitted for approval. Brand Story modules are neither Standard nor Premium.
const MAX_PREMIUM_MODULES = 7;
// Minimum crop sizes per image field (module -> field -> [w, h]).
const IMAGE_MIN = {
  premiumImageText: { image: [1464, 600] },
  premiumDualImageText: { image1: [1464, 600], image2: [1464, 600] },
  premiumHotspotImageText: { mobileImage: [600, 450] },
  premiumHotspotImage: { mobileImage: [600, 450] },
  standardHeaderImageText: { image: [970, 600] },
  standardSingleSideImage: { image: [300, 300] },
  brandStoryAbout: { logoImage: [362, 453] },
  brandStoryImageWithLogo: { desktopImage: [1464, 625], mobileImage: [463, 625] },
};
// Hotspot placement: pixel coordinates on the 1464x600 desktop image, at least 23 px from every edge
// (x in [23, 1441], y in [23, 577]); two hotspots whose 95 px squares intersect "overlap".
const HOTSPOT_MARGIN = 23,
  HOTSPOT_MIN_DISTANCE = 95;

const err = (details) => ({ code: 'InvalidInput', message: MESSAGE, details });

export function validateDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') return [err(`${PREFIX}: must not be null`)];
  if (!doc.name || doc.name.length > 100) errors.push(err(`${PREFIX}.name: size must be between 1 and 100`));
  if (!doc.contentType || !catalog.contentTypes.includes(doc.contentType))
    errors.push(err(`${PREFIX}.contentType: must not be null`));
  if (!doc.locale || !/^[a-z]{2,}-[A-Z0-9]{2,}$/.test(doc.locale))
    errors.push(err(`${PREFIX}.locale: must match "^[a-z]{2,}-[A-Z0-9]{2,}$"`));
  const modules = doc.contentModuleList;
  if (!Array.isArray(modules) || modules.length === 0) {
    errors.push(err(`${PREFIX}.contentModuleList: may not be empty`));
    return errors;
  }

  // Stage 1 (request body validation): every failing field, all at once.
  modules.forEach((m, i) => {
    const spec = byType[m.contentModuleType];
    if (!spec) {
      errors.push(err(`${PREFIX}.contentModuleList[${i}].contentModuleType: must not be null`));
      return;
    }
    const body = m[spec.key];
    if (!body) {
      errors.push({
        code: 'InvalidInput',
        message: MESSAGE,
        details: 'Content missing for given content module type!',
      });
      return;
    }
    walk(body, spec.schema, `${PREFIX}.contentModuleList[${i}].${spec.key}`, errors, spec.key);
    if (Array.isArray(body.hotSpots))
      checkHotspots(body, `${PREFIX}.contentModuleList[${i}].${spec.key}.hotSpots`, errors);
  });
  if (errors.length) return errors;

  // Stage 2 (document-level rules): STANDARD_* + PREMIUM_* in one list is rejected; a list holding a PREMIUM_* module
  // is capped at 7. BRAND_STORY_* modules belong to neither set, so the API does not reject them inside an EBC
  // document. Either violation is a single error.
  const tiers = new Set(modules.map((m) => byType[m.contentModuleType]?.tier).filter((t) => t && t !== 'brandStory'));
  if (tiers.size > 1)
    return [
      {
        code: 'InvalidInput',
        message: MESSAGE,
        details: 'Content documents cannot contain both premium and standard module types.',
      },
    ];
  if (tiers.has('premium') && modules.length > MAX_PREMIUM_MODULES)
    return [
      {
        code: 'InvalidInput',
        message: MESSAGE,
        details: `Content module lists cannot have more than ${MAX_PREMIUM_MODULES} modules.`,
      },
    ];
  return errors;
}

/** HotSpotsValidator: pixel coordinates on the desktop image; each marker owns a 95 px square from its coordinate,
 *  markers must stay 23 px from every edge, and two squares that intersect "overlap" (reported on the later index). */
function checkHotspots(body, path, errors) {
  const size = body.desktopImage?.imageCropSpecification?.size;
  const w = size?.width?.value ?? 1464,
    h = size?.height?.value ?? 600;
  const pts = body.hotSpots.map((hs) => {
    const s = hs.imageTextHotSpot ?? hs.imageHotSpot ?? {};
    return [Number(s.xCoordinate?.value), Number(s.yCoordinate?.value)];
  });
  const valid = [];
  pts.forEach(([x, y], i) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(err(`${path}[${i}]: invalid coordinate format`));
      return;
    }
    if (x < HOTSPOT_MARGIN || y < HOTSPOT_MARGIN || x > w - HOTSPOT_MARGIN || y > h - HOTSPOT_MARGIN) {
      errors.push(err(`${path}[${i}]: hotspot placement out of bounds`));
      return;
    }
    const hit = valid.find(
      ([ox, oy]) =>
        !(
          ox + HOTSPOT_MIN_DISTANCE <= x ||
          x + HOTSPOT_MIN_DISTANCE <= ox ||
          oy + HOTSPOT_MIN_DISTANCE <= y ||
          y + HOTSPOT_MIN_DISTANCE <= oy
        ),
    );
    if (hit) {
      errors.push(err(`${path}[${i}]: overlaps with hotspot at index ${hit[2]}`));
      return;
    }
    valid.push([x, y, i]);
  });
}

function walk(value, schema, path, errors, moduleKey) {
  for (const f of schema.fields) {
    const v = value?.[f.name];
    const p = `${path}.${f.name}`;
    if (v === undefined || v === null) {
      if (f.required) errors.push(err(`${p}: must not be null`));
      continue;
    }
    switch (f.type) {
      case 'TextComponent':
        checkText(v, p, errors, TEXT_MAX[f.name] ?? 500, f.required);
        break;
      case 'ParagraphComponent':
        checkParagraph(v, p, errors);
        break;
      case 'ImageComponent':
        checkImage(v, p, errors, IMAGE_MIN[moduleKey]?.[f.name]);
        break;
      case 'VideoComponent':
        for (const k of ['videoMediaId', 'imageMediaId', 'imageCropSpecification'])
          if (!v[k]) errors.push(err(`${p}.${k}: must not be null`));
        break;
      case 'Asin':
        if (typeof v.value !== 'string' || v.value.length !== 10)
          errors.push(err(`${p}.value: length must be between 10 and 10`));
        break;
      case 'array': {
        if (!Array.isArray(v)) {
          errors.push(err(`${p}: must not be null`));
          break;
        }
        if (f.maxItems && v.length > f.maxItems)
          errors.push(err(`${p}: size must be between ${f.minItems ?? 0} and ${f.maxItems}`));
        if (f.minItems && v.length < f.minItems)
          errors.push(err(`${p}: size must be between ${f.minItems} and ${f.maxItems ?? 2147483647}`));
        const positions = new Map(); // positions are unique within one list (productColumns and metricRowLabels each start at 1)
        v.forEach((item, idx) => {
          if (f.itemSchema) walk(item, f.itemSchema, `${p}[${idx}]`, errors, moduleKey);
          if (item && typeof item === 'object' && 'position' in item) {
            if (positions.has(item.position))
              errors.push({
                code: 'InvalidInput',
                message: MESSAGE,
                details: `Duplicate position found: ${item.position}`,
              });
            positions.set(item.position, true);
          }
        });
        break;
      }
      case 'integer':
        if (f.minimum !== undefined && v < f.minimum)
          errors.push(err(`${p}: must be greater than or equal to ${f.minimum}`));
        if (f.maximum !== undefined && v > f.maximum)
          errors.push(err(`${p}: must be less than or equal to ${f.maximum}`));
        break;
      case 'string': {
        // plain strings with bounds in the model: comparison table titles (80) and comparison values (250)
        if (typeof v !== 'string' || (f.required && v.length === 0)) {
          errors.push(err(`${p}: may not be empty`));
          break;
        }
        const min = f.minLength ?? 0,
          max = f.maxLength ?? 2147483647;
        if (v.length < min || v.length > max) errors.push(err(`${p}: length must be between ${min} and ${max}`));
        break;
      }
      default:
        if (f.enum && !f.enum.includes(v)) errors.push(err(`${p}: must not be null`));
        else if (f.schema && typeof v === 'object') walk(v, f.schema, p, errors, moduleKey);
    }
  }
}

function checkText(v, p, errors, max, required) {
  const s = v?.value;
  if (typeof s !== 'string' || (required && s.length === 0)) {
    errors.push(err(`${p}.value: may not be empty`));
    return;
  }
  if (s.length > max) errors.push(err(`${p}.value: length must be between ${required ? 1 : 0} and ${max}`));
}

function checkParagraph(v, p, errors) {
  const list = v?.textList;
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(err(`${p}.textList: may not be empty`));
    return;
  }
  if (list.length > PARAGRAPH_MAX.items)
    errors.push(err(`${p}.textList: Total text items ${list.length} exceeds maximum of ${PARAGRAPH_MAX.items}`));
  const total = list.reduce((n, t) => n + (t?.value?.length || 0), 0);
  if (total > PARAGRAPH_MAX.total)
    errors.push(err(`${p}.textList: Total text length ${total} exceeds maximum of ${PARAGRAPH_MAX.total}`));
  list.forEach((t, i) => {
    if (!t?.value) errors.push(err(`${p}.textList[${i}].value: may not be empty`));
  });
}

function checkImage(v, p, errors, min) {
  if (!v.uploadDestinationId) errors.push(err(`${p}.uploadDestinationId: may not be empty`));
  const size = v.imageCropSpecification?.size;
  if (!size) {
    errors.push(err(`${p}.imageCropSpecification: must not be null`));
    return;
  }
  if (min) {
    if ((size.height?.value ?? 0) < min[1])
      errors.push(err(`${p}.imageCropSpecification.size.height.value: must be greater than or equal to ${min[1]}`));
    if ((size.width?.value ?? 0) < min[0])
      errors.push(err(`${p}.imageCropSpecification.size.width.value: must be greater than or equal to ${min[0]}`));
  }
}
