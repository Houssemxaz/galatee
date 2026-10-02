import { lazy, Suspense, useEffect, useState } from "react";
import Sidebar from "./layout/Sidebar.jsx";
import Topbar from "./layout/Topbar.jsx";
import CommandPalette from "./layout/CommandPalette.jsx";
import OrdersPage from "./orders/OrdersPage.jsx";

// Code-splitting : seule OrdersPage (section par defaut) reste eager pour
// eviter un flash au chargement du back-office. Les autres sections chargent
// leur bundle a la volee au premier clic. Recharts (~120 kB) est isole dans
// le chunk analytics, react-day-picker (~60 kB) dans delivery, etc.
const MenuSection = lazy(() => import("./menu/MenuSection.jsx"));
const AnalyticsSection = lazy(() => import("./analytics/AnalyticsSection.jsx"));
const LoyaltyPage = lazy(() => import("./loyalty/LoyaltyPage.jsx"));
const PromotionsPage = lazy(() => import("./marketing/PromotionsPage.jsx"));
const ClubPage = lazy(() => import("./club/ClubPage.jsx"));
const DeliveryPage = lazy(() => import("./delivery/DeliveryPage.jsx"));
const DriversPage = lazy(() => import("./drivers/DriversPage.jsx"));

const SECTIONS = {
  orders: { label: "Commandes", render: () => <OrdersPage /> },
  menu: { label: "Menu", render: () => <MenuSection /> },
  stats: { label: "Statistiques", render: () => <AnalyticsSection /> },
  loyalty: { label: "Fidélité", render: ({ onNavigate }) => <LoyaltyPage onNavigate={onNavigate} /> },
  promotions: { label: "Promotions", render: ({ onNavigate }) => <PromotionsPage onNavigate={onNavigate} /> },
  club: { label: "Pasta Lover Club", render: () => <ClubPage /> },
  delivery: { label: "Livraison", render: () => <DeliveryPage /> },
  drivers: { label: "Livreurs", render: () => <DriversPage /> },
};

function SectionFallback({ label }) {
  return (
    <div className="bo-section-loading" role="status" aria-live="polite">
      Chargement de la section {label}…
    </div>
  );
}

// Linear-style: `g` puis lettre → naviguer.
const G_SHORTCUTS = {
  o: "orders",
  m: "menu",
  d: "delivery",
  s: "stats",
  f: "loyalty",
  p: "promotions",
  c: "club",
  l: "drivers",
};

export default function BackofficeApp() {
  const [active, setActive] = useState("orders");
  const [gArmed, setGArmed] = useState(false);

  // g + letter shortcuts (Linear-style)
  useEffect(() => {
    function isEditableTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }
    function keydown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (!gArmed && e.key.toLowerCase() === "g") {
        setGArmed(true);
        setTimeout(() => setGArmed(false), 1200);
        return;
      }
      if (gArmed) {
        const next = G_SHORTCUTS[e.key.toLowerCase()];
        if (next) {
          e.preventDefault();
          setActive(next);
        }
        setGArmed(false);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [gArmed]);

  return (
    <div className="bo-shell">
      <Sidebar active={active} onNavigate={setActive} />
      <div className="bo-frame">
        <Topbar sectionLabel={SECTIONS[active].label} />
        <main className="bo-main">
          <div className="bo-view">
            <Suspense fallback={<SectionFallback label={SECTIONS[active].label} />}>
              {SECTIONS[active].render({ onNavigate: setActive })}
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette onNavigate={setActive} />
    </div>
  );
}
