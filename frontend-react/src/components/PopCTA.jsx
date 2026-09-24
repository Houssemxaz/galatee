/**
 * PopCTA — 3D pushable button in Galatée palette.
 * Skeuomorphic press effect: multi-shadow stack, translateY on hover/active.
 * Adapts to :active for a satisfying tactile "click" — perfect for
 * primary intent buttons (e.g. "Commander ce plat" on a dish page).
 */
export default function PopCTA({
  as: Tag = "button",
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag {...rest} className={`pop-cta ${className}`}>
      <span className="pop-cta-inner">{children}</span>
    </Tag>
  );
}
