/**
 * GlowCard — animated conic-gradient glow border in Galatée palette.
 * Wraps arbitrary children without forcing dimensions.
 * Palette: tomato → terracotta → gold → basil (warm rotation).
 * Respects prefers-reduced-motion (glow freezes to a static gold rim).
 */
export default function GlowCard({ as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag {...rest} className={`glow-card ${className}`}>
      <span className="glow-card-halo" aria-hidden="true" />
      <span className="glow-card-inner">{children}</span>
    </Tag>
  );
}
