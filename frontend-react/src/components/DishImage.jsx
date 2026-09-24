/**
 * DishImage — wraps <picture> with WebP srcset + PNG fallback.
 * Uses generated -640.webp / -960.webp variants (see scripts/optimize-images.mjs).
 * Falls back gracefully to PNG if WebP isn't supported.
 */
export default function DishImage({
  dish,
  className,
  sizes = "(max-width: 720px) 100vw, 33vw",
  loading = "lazy",
  eager = false,
}) {
  const isEager = eager || loading === "eager";
  return (
    <picture>
      {dish.webpSrcSet && (
        <source type="image/webp" srcSet={dish.webpSrcSet} sizes={sizes} />
      )}
      <img
        src={dish.image}
        alt={dish.alt || ""}
        className={className}
        loading={isEager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={isEager ? "high" : "auto"}
      />
    </picture>
  );
}
