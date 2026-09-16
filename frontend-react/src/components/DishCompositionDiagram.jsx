import { useId, useLayoutEffect, useRef, useState } from "react";

function getLabelEdge(labelRect, wrapRect, target) {
  const left = labelRect.left - wrapRect.left;
  const top = labelRect.top - wrapRect.top;
  const width = labelRect.width;
  const height = labelRect.height;
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const dx = target.x - centerX;
  const dy = target.y - centerY;
  const halfWidth = Math.max(width / 2, 1);
  const halfHeight = Math.max(height / 2, 1);
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1);

  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

export default function DishCompositionDiagram({ src, alt, annotations, className = "" }) {
  const diagramRef = useRef(null);
  const imageRef = useRef(null);
  const labelRefs = useRef({});
  const [layout, setLayout] = useState(null);
  const markerId = `dish-arrow-${useId().replace(/:/g, "")}`;

  useLayoutEffect(() => {
    let frameId = 0;

    function measure() {
      const diagram = diagramRef.current;
      const image = imageRef.current;
      if (!diagram || !image) return;

      const diagramRect = diagram.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      if (!diagramRect.width || !imageRect.width || !imageRect.height) return;

      const nextLines = {};
      annotations.forEach((annotation) => {
        const label = labelRefs.current[annotation.id];
        if (!label) return;
        const target = {
          x: imageRect.left - diagramRect.left + imageRect.width * annotation.target.x,
          y: imageRect.top - diagramRect.top + imageRect.height * annotation.target.y,
        };
        const start = getLabelEdge(label.getBoundingClientRect(), diagramRect, target);
        nextLines[annotation.id] = { start, target };
      });

      setLayout({ width: diagramRect.width, height: diagramRect.height, lines: nextLines });
    }

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const timeoutId = window.setTimeout(scheduleMeasure, 250);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
    };
  }, [annotations]);

  return (
    <figure className={`dish-composition ${className}`.trim()} ref={diagramRef}>
      <div className="dish-composition-art">
        <img ref={imageRef} src={src} alt={alt} loading="eager" onLoad={() => window.dispatchEvent(new Event("resize"))} />
      </div>

      {layout && (
        <svg
          className="dish-composition-svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <marker id={markerId} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
          </defs>
          {annotations.map((annotation) => {
            const line = layout.lines[annotation.id];
            if (!line) return null;
            return (
              <g key={annotation.id} className="dish-composition-connector">
                <line
                  x1={line.start.x}
                  y1={line.start.y}
                  x2={line.target.x}
                  y2={line.target.y}
                  markerEnd={`url(#${markerId})`}
                />
                <circle cx={line.target.x} cy={line.target.y} r="2.4" />
              </g>
            );
          })}
        </svg>
      )}

      <figcaption className="dish-composition-labels">
        {annotations.map((annotation) => (
          <span
            key={annotation.id}
            className={`dish-composition-label dish-composition-label-${annotation.position || "top-left"}`}
            ref={(element) => { labelRefs.current[annotation.id] = element; }}
          >
            <strong>{annotation.title}</strong>
            <small>{annotation.detail}</small>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
