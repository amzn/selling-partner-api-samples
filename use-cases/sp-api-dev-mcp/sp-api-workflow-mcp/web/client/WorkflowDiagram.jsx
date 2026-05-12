import React, { useEffect, useRef, useState, useCallback } from 'react';

let renderCounter = 0;

export default function WorkflowDiagram({ mermaid: mermaidCode, stateCount }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const zoomIn = () => setZoom(z => Math.min(z + 0.25, 6));
  const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const zoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const fitSvgToPanel = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const canvasRect = canvas.getBoundingClientRect();
    const vb = svg.viewBox?.baseVal;
    const svgW = vb?.width || parseFloat(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
    const svgH = vb?.height || parseFloat(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
    if (!svgW || !svgH) return;

    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    }

    const padding = 32;
    const availW = canvasRect.width - padding;
    const availH = canvasRect.height - padding;
    const scale = Math.min(availW / svgW, availH / svgH);
    svg.setAttribute('width', svgW * scale);
    svg.setAttribute('height', svgH * scale);
    svg.style.maxWidth = 'none';

    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    e.preventDefault();
  }, [pan]);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, 0.25), 6));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Render mermaid using mermaid.run() on a <pre> element — same approach
  // as the working test page, avoids issues with bundled mermaid.render().
  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;

    let cancelled = false;
    const id = `mermaid-pre-${++renderCounter}`;

    // Insert a <pre class="mermaid"> element and let mermaid.run() process it
    containerRef.current.innerHTML = `<pre class="mermaid" id="${id}">${mermaidCode}</pre>`;

    (async () => {
      try {
        const mm = await import('mermaid');
        const mermaid = mm.default;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        await mermaid.run({ nodes: [document.getElementById(id)] });

        if (!cancelled) {
          setError(null);
          requestAnimationFrame(() => {
            if (!cancelled) fitSvgToPanel();
          });
        }
      } catch (err) {
        console.error('[WorkflowDiagram] mermaid error:', err);
        if (!cancelled) {
          setError(err.message || 'Failed to render diagram');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mermaidCode]);

  return (
    <div className="workflow-diagram">
      <div className="workflow-diagram-header">
        <span className="workflow-diagram-title">Workflow</span>
        <div className="workflow-diagram-controls">
          {stateCount > 0 && (
            <span className="workflow-diagram-badge">{stateCount} state{stateCount !== 1 ? 's' : ''}</span>
          )}
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={zoomOut} title="Zoom out">-</button>
            <button className="zoom-label" onClick={zoomReset} title="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button className="zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
          </div>
        </div>
      </div>
      <div
        className={`workflow-diagram-canvas ${dragging.current ? 'diagram-grabbing' : ''}`}
        ref={canvasRef}
        onMouseDown={onMouseDown}
      >
        <div
          ref={containerRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: dragging.current ? 'none' : 'transform 0.2s ease',
          }}
        />
      </div>
      {error && (
        <div style={{padding:'12px',color:'red',fontSize:'13px'}}>
          <p>Render error: {error}</p>
        </div>
      )}
    </div>
  );
}
