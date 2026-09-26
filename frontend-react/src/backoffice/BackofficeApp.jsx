import { useEffect, useState } from "react";
import Sidebar from "./layout/Sidebar.jsx";
import Topbar from "./layout/Topbar.jsx";
import CommandPalette from "./layout/CommandPalette.jsx";
import MenuSection from "./menu/MenuSection.jsx";
import AnalyticsSection from "./analytics/AnalyticsSection.jsx";
import OrdersPage from "./orders/OrdersPage.jsx";
import LoyaltyPage from "./loyalty/LoyaltyPage.jsx";
import ClubPage from "./club/ClubPage.jsx";
import DeliveryPage from "./delivery/DeliveryPage.jsx";
import DriversPage from "./drivers/DriversPage.jsx";

const SECTIONS = {
  orders: { label: "Commandes", render: () => <OrdersPage /> },
  menu: { label: "Menu", render: () => <MenuSection /> },
  stats: { label: "Statistiques", render: () => <AnalyticsSection /> },
  loyalty: { label: "Fidélité", render: () => <LoyaltyPage /> },
  club: { label: "Pasta Lover Club", render: () => <ClubPage /> },
  delivery: { label: "Livraison", render: () => <DeliveryPage /> },
  drivers: { label: "Livreurs", render: () => <DriversPage /> },
};

// Linear-style: `g` puis lettre → naviguer.
const G_SHORTCUTS = {
  o: "orders",
  m: "menu",
  d: "delivery",
  s: "stats",
  f: "loyalty",
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
            {SECTIONS[active].render()}
          </div>
        </main>
      </div>
      <CommandPalette onNavigate={setActive} />
    </div>
  );
}
