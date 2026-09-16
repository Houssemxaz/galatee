import { useState } from "react";
import Sidebar from "./layout/Sidebar.jsx";
import Topbar from "./layout/Topbar.jsx";
import MenuSection from "./menu/MenuSection.jsx";
import AnalyticsSection from "./analytics/AnalyticsSection.jsx";
import OrdersPage from "./orders/OrdersPage.jsx";
import LoyaltyPage from "./loyalty/LoyaltyPage.jsx";
import ClubPage from "./club/ClubPage.jsx";
import DeliveryPage from "./delivery/DeliveryPage.jsx";

const SECTIONS = {
  orders: { label: "Commandes", render: () => <OrdersPage /> },
  menu: { label: "Menu", render: () => <MenuSection /> },
  stats: { label: "Statistiques", render: () => <AnalyticsSection /> },
  loyalty: { label: "Fidélité", render: () => <LoyaltyPage /> },
  club: { label: "Pasta Lover Club", render: () => <ClubPage /> },
  delivery: { label: "Livraison", render: () => <DeliveryPage /> },
};

export default function BackofficeApp() {
  const [active, setActive] = useState("orders");

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
    </div>
  );
}
