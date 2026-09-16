import { useEffect, useRef, useState } from "react";

export default function useCountUp(target, { duration = 900, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const finalTarget = Number(target) || 0;
    if (startedRef.current && finalTarget === value) return undefined;
    startedRef.current = true;

    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(finalTarget);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      const start = performance.now();
      const from = 0;
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(from + (finalTarget - from) * eased));
        if (t < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
}
