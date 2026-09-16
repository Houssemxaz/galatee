export default function BrandLogo({ className = "", ariaLabel = "Pasta by Galatée" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 180"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
    >
      <ellipse
        cx="210"
        cy="82"
        rx="176"
        ry="62"
        fill="none"
        stroke="currentColor"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <text
        x="210"
        y="108"
        textAnchor="middle"
        fontFamily="Caveat, cursive"
        fontWeight="700"
        fontSize="86"
        fill="currentColor"
        style={{ letterSpacing: "0.01em" }}
      >
        PASTA
      </text>
      <text
        x="298"
        y="152"
        textAnchor="middle"
        fontFamily="Caveat, cursive"
        fontStyle="italic"
        fontWeight="500"
        fontSize="22"
        fill="currentColor"
        opacity="0.78"
      >
        by Galatée
      </text>
    </svg>
  );
}
