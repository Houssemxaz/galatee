import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function ShineCTA({
  as: Tag = "button",
  className = "",
  children,
  shineColor,
  ...rest
}) {
  const reduce = useReducedMotion();

  const MotionTag = useMemo(() => {
    if (typeof Tag === "string") return motion[Tag] || motion.button;
    return motion.create ? motion.create(Tag) : motion(Tag);
  }, [Tag]);

  const style = shineColor ? { "--shine-cta-color": shineColor } : undefined;

  return (
    <MotionTag
      {...rest}
      style={{ ...style, ...(rest.style || {}) }}
      className={`shine-cta ${className}`}
      whileHover={reduce ? undefined : { scale: 1.015 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
    >
      <motion.span
        className="shine-cta-inner"
        style={{
          WebkitMaskImage:
            "linear-gradient(-75deg, white calc(var(--mask-x) + 20%), transparent calc(var(--mask-x) + 30%), white calc(var(--mask-x) + 100%))",
          maskImage:
            "linear-gradient(-75deg, white calc(var(--mask-x) + 20%), transparent calc(var(--mask-x) + 30%), white calc(var(--mask-x) + 100%))",
        }}
        initial={{ ["--mask-x"]: "100%" }}
        animate={reduce ? { ["--mask-x"]: "100%" } : { ["--mask-x"]: "-100%" }}
        transition={{
          repeat: reduce ? 0 : Infinity,
          duration: 1.6,
          ease: "linear",
          repeatDelay: 2.4,
        }}
      >
        {children}
      </motion.span>

      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="shine-cta-border"
          initial={{ backgroundPosition: "100% 0", opacity: 0 }}
          animate={{ backgroundPosition: ["100% 0", "0% 0"], opacity: [0, 1, 0] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 2.4,
          }}
        />
      )}
    </MotionTag>
  );
}
