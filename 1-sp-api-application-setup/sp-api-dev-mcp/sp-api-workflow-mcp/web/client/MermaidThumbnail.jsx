import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let initialized = false;
let thumbCounter = 0;

/**
 * Renders a small, non-interactive mermaid diagram thumbnail.
 * Fetches the diagram from /api/workflows/:id/diagram on mount.
 */
export default function MermaidThumbnail({ workflowId }) {
  const containerRef = useRef(null);
  const [mermaidCode, setMermaidCode] = useState(null);
  const [failed, setFailed] = useState(false);

  // Fetch diagram data
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    fetch(`/api/workflows/${workflowId}/diagram`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.mermaid) {
          setMermaidCode(data.mermaid);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workflowId]);

  // Render mermaid SVG
  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;

    if (!initialized) {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      initialized = true;
    }

    let cancelled = false;
    const id = `thumb-${++thumbCounter}`;

    (async () => {
      try {
        const { svg } = await mermaid.render(id, mermaidCode);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG fill the container
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.setAttribute('width', '100%');
            svgEl.setAttribute('height', '100%');
            svgEl.style.maxWidth = 'none';
          }
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [mermaidCode]);

  if (!mermaidCode || failed) return null;

  return (
    <div className="wf-card-thumbnail" ref={containerRef} />
  );
}
