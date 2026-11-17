// Access to shared/module-catalog.json (generated from the OpenAPI model by shared/build-module-catalog.py).
// The catalog drives both the editor forms and the mock validator, so the UI never hard-codes a field list.
import catalogJson from '@shared/module-catalog.json';
import type { ContentModule } from './api';

export type Field = {
  name: string;
  required: boolean;
  type: string; // 'TextComponent' | 'ParagraphComponent' | 'ImageComponent' | 'VideoComponent' | 'array' | 'integer' | 'string' | 'boolean' | <enum/definition name>
  enum?: string[];
  schema?: Schema; // nested object definition
  item?: string; // array item type
  itemSchema?: Schema; // array item definition (wrapper objects like TechSpecs)
  maxItems?: number | null;
  minItems?: number | null;
  minimum?: number;
  maximum?: number;
};
export type Schema = { name: string; fields: Field[] };
export type ModuleSpec = {
  type: string;
  key: string;
  tier: 'standard' | 'premium' | 'brandStory';
  definition: string;
  schema: Schema;
};

export const catalog = catalogJson as unknown as {
  source: string;
  contentTypes: string[];
  contentStatus: string[];
  contentBadges: string[];
  asinBadges: string[];
  modules: ModuleSpec[];
};
export const modulesByType: Record<string, ModuleSpec> = Object.fromEntries(catalog.modules.map((m) => [m.type, m]));
export const tierOf = (m: ContentModule) => modulesByType[m.contentModuleType]?.tier;

/** Recommended image sizes (w x h) from the A+ reference; used as the default crop and shown in the editor. */
export const IMAGE_SIZES: Record<string, [number, number]> = {
  'standardHeaderImageText.block.image': [970, 600],
  'standardSingleSideImage.block.image': [300, 300],
  'standardThreeImageText.block1.image': [300, 300],
  'standardThreeImageText.block2.image': [300, 300],
  'standardThreeImageText.block3.image': [300, 300],
  'standardFourImageText.block1.image': [220, 220],
  'standardFourImageText.block2.image': [220, 220],
  'standardFourImageText.block3.image': [220, 220],
  'standardFourImageText.block4.image': [220, 220],
  'standardImageTextOverlay.block.image': [970, 300],
  'standardCompanyLogo.companyLogo': [600, 180],
  'standardSingleImageHighlights.image': [300, 300],
  'premiumImageText.image': [1464, 600],
  'premiumFullBackgroundImage.desktopImage': [1464, 600],
  'premiumFullBackgroundImage.mobileImage': [600, 450],
  'premiumFullBackgroundText.desktopImage': [1464, 600],
  'premiumFullBackgroundText.mobileImage': [600, 450],
  'premiumDualImageText.columns.imageColumn.image': [650, 650],
  'premiumFourColumnImages.columns.imageColumn.image': [300, 300],
  'premiumImageCarousel.carouselCards.imagePanel.desktopImage': [1464, 600],
  'premiumImageCarousel.carouselCards.imagePanel.mobileImage': [600, 450],
  'brandStoryImageWithLogo.desktopImage': [1464, 625],
  'brandStoryImageWithLogo.mobileImage': [463, 625],
  'brandStoryAbout.logoImage': [362, 453],
  'brandStoryMediaAsset.image': [362, 453],
  'brandStoryFourAsin.asinImages.asinImage.productImage': [166, 166],
};
export const imageSizeFor = (path: string): [number, number] => IMAGE_SIZES[path.replace(/\[\d+\]/g, '')] ?? [970, 600];

const pixels = (value: number) => ({ value, units: 'pixels' as const });
export const emptyImage = (path: string) => {
  const [w, h] = imageSizeFor(path);
  return {
    uploadDestinationId: '',
    altText: '',
    imageCropSpecification: { size: { width: pixels(w), height: pixels(h) }, offset: { x: pixels(0), y: pixels(0) } },
  };
};

/** Empty value for a field, filling required nested structures so the form has something to bind to. */
export function emptyValue(field: Field, path: string): unknown {
  switch (field.type) {
    case 'TextComponent':
      return { value: '' };
    case 'ParagraphComponent':
      return { textList: [{ value: '' }] };
    case 'ImageComponent':
      return emptyImage(path);
    case 'VideoComponent':
      return { videoMediaId: '', imageMediaId: '', imageCropSpecification: emptyImage(path).imageCropSpecification };
    case 'Asin':
      return { value: '' };
    case 'integer':
      return field.minimum ?? 1;
    case 'boolean':
      return false;
    case 'string':
      return '';
    case 'array': {
      const n = field.minItems ?? (field.required ? 1 : 0);
      return Array.from({ length: n }, (_, i) =>
        field.itemSchema ? emptyObject(field.itemSchema, `${path}`, i + 1) : '',
      );
    }
    default:
      if (field.enum) return field.enum[0];
      if (field.schema) return emptyObject(field.schema, path);
      return '';
  }
}

export function emptyObject(schema: Schema, path: string, position?: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.name === 'position' && position !== undefined) {
      out.position = position;
      continue;
    }
    if (f.required || ['TextComponent', 'ParagraphComponent', 'ImageComponent'].includes(f.type) || f.schema)
      out[f.name] = emptyValue(f, `${path}.${f.name}`);
  }
  return out;
}

export function newModule(type: string): ContentModule {
  const spec = modulesByType[type];
  return { contentModuleType: type, [spec.key]: emptyObject(spec.schema, spec.key) };
}

export const label = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bAsin\b/g, 'ASIN');
export const moduleLabel = (type: string) =>
  type
    .replace(/^(STANDARD|PREMIUM|BRAND_STORY)_/, '')
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
