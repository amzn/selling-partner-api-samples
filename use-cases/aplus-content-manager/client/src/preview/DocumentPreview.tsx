// Document-only preview: the A+ slot this document feeds, rendered at desktop width on its own, the way
// Seller Central previews a document before it is applied to anything. The heading is the one the
// publisher gets on amazon.com: "Product description" for a seller's EBC document, "From the manufacturer"
// for a vendor's EMC document, "From the brand" for a Brand Story. The same module renderers and Amazon
// CSS as the detail-page simulation are used, so switching to the product page later changes only the
// surroundings, never the modules.
import { slotHeading, type ContentDocument } from '../api';
import { modulesByType } from '../catalog';
import { AplusContent } from './AplusModules';
import { BrandStory } from './BrandStory';
import './amazon-dp.css';
import './aplus.css';

export function DocumentPreview({ document }: { document: ContentDocument | null }) {
  const isBrandStory = document?.contentType === 'BrandStory';
  const modules = (document?.contentModuleList ?? []).filter(
    (m) => (modulesByType[m.contentModuleType]?.tier === 'brandStory') === isBrandStory,
  );
  return (
    <div className="dp-page dp-document-only">
      <div className="dp-bucket" id={isBrandStory ? 'aplusBrandStory_feature_div' : 'aplus_feature_div'}>
        <div className="a-section a-spacing-large bucket" id={isBrandStory ? undefined : 'aplus'}>
          <hr className="bucketDivider" />
          <h2>{slotHeading(document?.contentType ?? 'EBC')}</h2>
          {modules.length === 0 ? (
            <div className="dp-empty-aplus">Add modules in the editor to see them here.</div>
          ) : isBrandStory ? (
            <BrandStory modules={modules} />
          ) : (
            <AplusContent modules={modules} />
          )}
        </div>
      </div>
    </div>
  );
}
