export default function MarketingTabs({ active, onNavigate }) {
  return (
    <div className="bo-marketing-tabs" role="tablist" aria-label="Marketing">
      <button
        type="button"
        role="tab"
        aria-selected={active === "loyalty"}
        className={active === "loyalty" ? "is-active" : ""}
        onClick={() => onNavigate?.("loyalty")}
      >
        Fidélité
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "promotions"}
        className={active === "promotions" ? "is-active" : ""}
        onClick={() => onNavigate?.("promotions")}
      >
        Promotions
      </button>
    </div>
  );
}
