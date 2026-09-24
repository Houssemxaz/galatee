import { useState } from "react";

/**
 * FlipSocial — 3D flip button for social links.
 * Front: platform icon (paper background).
 * Back: platform label (tomato background, paper text).
 * Individual hover flip per item — sober, tactile, Galatée-brand.
 */
export default function FlipSocial({ items = [], className = "" }) {
  return (
    <div className={`flip-social ${className}`}>
      {items.map((item, i) => (
        <FlipSocialItem key={item.label || i} item={item} />
      ))}
    </div>
  );
}

function FlipSocialItem({ item }) {
  const [hover, setHover] = useState(false);

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="flip-social-item"
      aria-label={item.label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <span
        className="flip-social-card"
        style={{ transform: hover ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <span className="flip-social-face flip-social-front" aria-hidden="true">
          {item.icon}
        </span>
        <span className="flip-social-face flip-social-back" aria-hidden="true">
          <span className="flip-social-label">{item.label}</span>
        </span>
      </span>
    </a>
  );
}
