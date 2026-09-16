import { useEffect, useRef, useState } from "react";

/**
 * Reveal wrapper — fades + slides children into view on scroll.
 * Robust: uses IntersectionObserver but falls back to force-visible after 250ms
 * to guarantee content is never permanently hidden (fixes above-the-fold flash).
 */
export default function Reveal({ children, className = "", delay = 0, variant = "up", threshold = 0.05 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    // Fallback: guarantee visibility within 250ms — protects above-the-fold content
    // when IntersectionObserver misfires or the element is on-mount visible
    const fallback = setTimeout(() => setVisible(true), 250);
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return () => clearTimeout(fallback);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
          clearTimeout(fallback);
        }
      },
      { threshold, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`reveal reveal-${variant} ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--delay": `${delay}ms` }}
    >
      {children}
    </div>
  );
}
