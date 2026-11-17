// "From the brand": the Brand Story hero (1464x625 background) with the 362x453 card carousel laid
// over it, exactly as amazon.com structures #aplusBrandStory_feature_div (see aplus.css). The first
// carousel slot is the empty `apm-brand-story-carousel-card-0` the live page also emits, which leaves
// the hero's bottom-left text panel visible.
import { useState } from 'react';
import type { ContentModule, ImageComponent, ParagraphComponent, TextComponent } from '../api';
import { modulesByType } from '../catalog';
import { AImg } from './AplusModules';

// Loose module payload, see the note on `Rec` in AplusModules.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;
const text = (c?: TextComponent) => c?.value?.trim() || '';
const paras = (c?: ParagraphComponent) => (c?.textList ?? []).map((t) => t.value?.trim()).filter(Boolean) as string[];
const Ps = ({ c }: { c?: ParagraphComponent }) => (
  <>
    {paras(c).map((t, i) => (
      <p key={i}>{t}</p>
    ))}
  </>
);

function Card({ module, brand }: { module: ContentModule; brand?: string }) {
  const spec = modulesByType[module.contentModuleType];
  const m = (module[spec?.key] ?? {}) as Rec;
  switch (module.contentModuleType) {
    case 'BRAND_STORY_FOUR_ASIN': {
      const asins = ([...(m.asinImages ?? [])] as Rec[]).map((a) => a.asinImage ?? {}).slice(0, 4);
      return (
        <div className="celwidget aplus-module brand-story-card-1-four-asin aplus-brand-story-card">
          <div className="apm-brand-story-card">
            <div className="apm-brand-story-image-grid" role="list">
              {Array.from({ length: 4 }, (_, i) => asins[i] ?? {}).map((a: Rec, i) => (
                <div className="apm-brand-story-image-grid-item" role="listitem" key={i}>
                  <a className="a-link-normal apm-brand-story-image-link" title={text(a.productAsin)}>
                    <AImg c={a.productImage as ImageComponent} className="apm-brand-story-image-img" cover />
                  </a>
                </div>
              ))}
            </div>
            <div className="apm-brand-story-text">
              <h3>{text(m.title) || 'Shop the brand'}</h3>
              <p className="apm-brand-story-stores-link">
                <a className="a-link-normal" aria-label="Visit this Brand's Amazon store">
                  Visit the Store
                </a>
              </p>
            </div>
          </div>
          <div style={{ clear: 'both' }} />
        </div>
      );
    }
    case 'BRAND_STORY_MEDIA_ASSET':
      return (
        <div className="celwidget aplus-module brand-story-card-2-media-asset aplus-brand-story-card">
          <div className="apm-brand-story-card">
            <div className="apm-brand-story-background-image">
              <AImg c={m.image} cover />
            </div>
            {(text(m.title) || paras(m.description).length > 0) && (
              <div className="apm-brand-story-text-bottom">
                {text(m.title) && <h3>{text(m.title)}</h3>}
                <Ps c={m.description} />
              </div>
            )}
          </div>
          <div style={{ clear: 'both' }} />
        </div>
      );
    case 'BRAND_STORY_ABOUT':
      return (
        <div className="celwidget aplus-module brand-story-card-3-about aplus-brand-story-card">
          <div className="apm-brand-story-card">
            <div className="apm-brand-story-logo-image">
              <AImg c={m.logoImage} alt={brand ? `${brand} logo` : 'brand logo'} />
            </div>
            <div className="apm-brand-story-slogan-text">
              {text(m.title) && <h3>{text(m.title)}</h3>}
              <Ps c={m.slogan} />
            </div>
          </div>
          <div style={{ clear: 'both' }} />
        </div>
      );
    case 'BRAND_STORY_QUESTIONS':
      return (
        <div className="celwidget aplus-module brand-story-card-4-questions aplus-brand-story-card">
          <div className="apm-brand-story-card">
            <div className="apm-brand-story-faq">
              {((m.questionAnswerPairs ?? []) as Rec[]).map((q, i) => {
                const p = q.questionAnswerPair ?? {};
                return (
                  <div className="apm-brand-story-faq-block" key={i}>
                    <h4>{text(p.question)}</h4>
                    <Ps c={p.answer} />
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ clear: 'both' }} />
        </div>
      );
    default:
      return null;
  }
}

export function BrandStory({ modules, brand }: { modules: ContentModule[]; brand?: string }) {
  const hero = modules.find((m) => m.contentModuleType === 'BRAND_STORY_IMAGE_WITH_LOGO');
  const cards = modules.filter((m) => m.contentModuleType !== 'BRAND_STORY_IMAGE_WITH_LOGO');
  const h = (hero?.[modulesByType.BRAND_STORY_IMAGE_WITH_LOGO?.key] ?? {}) as Rec;
  const visible = 3; // cards that fit next to the hero text panel at 1464px
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(cards.length / visible));
  return (
    <div className="aplus-v2 desktop celwidget">
      <div className="aplus-content-wrapper">
        <div>
          <div className="apm-brand-story-carousel-container">
            <div className="apm-brand-story-carousel-hero-container">
              <div className="celwidget aplus-module brand-story-hero-1-image-logo aplus-brand-story-hero">
                <div className="apm-brand-story-hero">
                  <div className="apm-brand-story-background-image">
                    <AImg c={h.desktopImage} cover />
                  </div>
                  {(text(h.title) || paras(h.description).length > 0) && (
                    <div className="apm-brand-story-text-bottom">
                      {text(h.title) && <h3>{text(h.title)}</h3>}
                      <Ps c={h.description} />
                    </div>
                  )}
                </div>
                <div style={{ clear: 'both' }} />
              </div>
            </div>
            <div
              className="a-begin a-carousel-container a-carousel-static apm-brand-story-carousel size-cards"
              role="region"
              aria-label="Featured content carousel"
            >
              <div className="a-row a-carousel-controls a-carousel-row a-carousel-has-buttons">
                <div className="a-carousel-row-inner">
                  <div className="a-carousel-col a-carousel-left">
                    {pages > 1 && (
                      <button
                        type="button"
                        className="a-button a-button-image a-carousel-button a-carousel-goto-prevpage"
                        aria-label="Previous page"
                        onClick={() => setPage((page - 1 + pages) % pages)}
                      >
                        <span className="a-button-inner">
                          <i className="a-icon a-icon-previous" />
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="a-carousel-col a-carousel-center">
                    <div className="a-carousel-viewport">
                      <ol
                        className="a-carousel"
                        role="list"
                        style={{ transform: `translateX(-${page * visible * 392}px)` }}
                      >
                        <li className="a-carousel-card apm-brand-story-carousel-card-0" />
                        {cards.map((c, i) => (
                          <li className={`a-carousel-card apm-brand-story-carousel-card-${i + 1}`} key={i}>
                            <Card module={c} brand={brand} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  <div className="a-carousel-col a-carousel-right">
                    {pages > 1 && (
                      <button
                        type="button"
                        className="a-button a-button-image a-carousel-button a-carousel-goto-nextpage"
                        aria-label="Next page"
                        onClick={() => setPage((page + 1) % pages)}
                      >
                        <span className="a-button-inner">
                          <i className="a-icon a-icon-next" />
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
