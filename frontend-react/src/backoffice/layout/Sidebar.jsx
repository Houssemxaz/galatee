import { LayoutGrid, LineChart, ExternalLink, Gift, ShoppingBag, UsersRound, Truck, Bike, Tag } from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Opérations",
    items: [
      { key: "orders", label: "Commandes", Icon: ShoppingBag, kbd: "G O" },
      { key: "menu", label: "Menu", Icon: LayoutGrid, kbd: "G M" },
      { key: "delivery", label: "Livraison", Icon: Truck, kbd: "G D" },
      { key: "drivers", label: "Livreurs", Icon: Bike, kbd: "G L" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { key: "stats", label: "Statistiques", Icon: LineChart, kbd: "G S" },
    ],
  },
  {
    label: "Fidélisation",
    items: [
      { key: "loyalty", label: "Fidélité", Icon: Gift, kbd: "G F" },
      { key: "promotions", label: "Promotions", Icon: Tag, kbd: "G P" },
      { key: "club", label: "Pasta Lover Club", Icon: UsersRound, kbd: "G C" },
    ],
  },
];

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="bo-sidebar" aria-label="Navigation back-office">
      <a className="bo-sidebar-brand" href="/backoffice.html" aria-label="Galatée — back-office">
        <span className="bo-sidebar-mark" aria-hidden="true">G</span>
        <span className="bo-sidebar-name">Galatée</span>
      </a>

      <nav className="bo-sidebar-nav" aria-label="Sections">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="bo-sidebar-group">
            <p className="bo-sidebar-section-label">{section.label}</p>
            {section.items.map(({ key, label, Icon, kbd }) => {
              const isActive = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`bo-sidebar-link ${isActive ? "is-active" : ""}`}
                  onClick={() => onNavigate(key)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                  {kbd && <span className="bo-kbd" aria-hidden="true">{kbd}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="bo-sidebar-foot">
        <a href="/" className="bo-sidebar-outlink" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
          <span>Voir le site</span>
        </a>
        <p className="bo-sidebar-hint">v1.0 · Hydra</p>
      </div>
    </aside>
  );
}
