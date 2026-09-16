import { useLayoutEffect, useRef, useState } from "react";

// Targets are RELATIVE positions on the plate image where the arrow tip should land.
// Bow = perpendicular curve fraction (0 = straight, >0 = arc around obstacle).
export default function HeroDish({
  plateSrc,
  zooms,          // [{ key, photo, label, target: {x, y}, bow }]
  className = "hero-dish-wrap",
}) {
  const wrapRef = useRef(null);
  const dishRef = useRef(null);
  const photoRefs = useRef({});
  const [lines, setLines] = useState(null);

  useLayoutEffect(() => {
    function measure() {
      const wrap = wrapRef.current;
      const dish = dishRef.current;
      if (!wrap || !dish) return;
      const wrapRect = wrap.getBoundingClientRect();
      const dishRect = dish.getBoundingClientRect();
      if (!dishRect.width || !dishRect.height) return;
      const next = {};
      zooms.forEach(({ key, target }) => {
        const photo = photoRefs.current[key];
        if (!photo) return;
        const photoRect = photo.getBoundingClientRect();
        if (!photoRect.width) return;
        const tx = dishRect.left + dishRect.width * target.x - wrapRect.left;
        const ty = dishRect.top + dishRect.height * target.y - wrapRect.top;
        const cx = photoRect.left + photoRect.width / 2 - wrapRect.left;
        const cy = photoRect.top + photoRect.height / 2 - wrapRect.top;
        const dx = tx - cx;
        const dy = ty - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const r = photoRect.width / 2;
        const sx = cx + (dx / dist) * r;
        const sy = cy + (dy / dist) * r;
        next[key] = { sx, sy, tx, ty };
      });
      setLines(next);
    }
    measure();
    const timeoutId = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [zooms]);

  return (
    <div className={className} ref={wrapRef}>
      <svg className="hero-dish-arc-svg" aria-hidden="true">
        {lines &&
          zooms.map(({ key, bow = 0 }) => {
            const l = lines[key];
            if (!l) return null;
            const dx = l.tx - l.sx;
            const dy = l.ty - l.sy;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = -dy / dist;
            const ny = dx / dist;
            const b = dist * bow;
            const c1x = l.sx + dx * 0.3 + nx * b;
            const c1y = l.sy + dy * 0.35 + ny * b;
            const c2x = l.sx + dx * 0.65 + nx * b;
            const c2y = l.sy + dy * 0.7 + ny * b;
            return (
              <g key={key}>
                <path className="hero-dish-arc-path" d={`M ${l.sx} ${l.sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${l.tx} ${l.ty}`} />
                <circle className="hero-dish-arc-dot" cx={l.sx} cy={l.sy} r="3" />
              </g>
            );
          })}
      </svg>
      <div className="hero-zoom-row">
        {zooms.map(({ key, photo, label }) => (
          <div key={key} className={`hero-zoom-callout hero-zoom-${key}`}>
            <div
              className="hero-zoom-photo"
              ref={(el) => { photoRefs.current[key] = el; }}
              aria-hidden="true"
            >
              <img src={photo} alt="" loading="eager" />
            </div>
            <div className="hero-zoom-label">{label}</div>
          </div>
        ))}
      </div>
      <div className="hero-dish-shadow" aria-hidden="true" />
      <div className="hero-dish" aria-hidden="true" ref={dishRef}>
        <img
          src={plateSrc}
          alt=""
          loading="eager"
          onLoad={() => window.dispatchEvent(new Event("resize"))}
        />
      </div>
    </div>
  );
}
