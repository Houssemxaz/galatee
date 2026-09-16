import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import DishPage from "@/pages/DishPage";
import OrderPage from "@/pages/OrderPage";
import InformationsPage from "@/pages/InformationsPage";
import ContactPage from "@/pages/ContactPage";
import NotFoundPage from "@/pages/NotFoundPage";
import AccountPage from "@/pages/AccountPage";
import PastaLoverClubPage from "@/pages/PastaLoverClubPage";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { trackEvent } from "@/lib/api";

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => { trackEvent("page_viewed"); }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <CustomerAuthProvider>
      <PageViewTracker />
      <div className="site-shell">
        <div className="site-grain" aria-hidden="true" />
        <a className="skip-link" href="#main-content">Aller au contenu</a>
        <SiteHeader />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/menu/:slug" element={<DishPage />} />
            <Route path="/commande" element={<OrderPage />} />
            <Route path="/reservation" element={<Navigate to="/commande" replace />} />
            <Route path="/pasta-lover-club" element={<PastaLoverClubPage />} />
            <Route path="/compte" element={<AccountPage />} />
            <Route path="/informations" element={<InformationsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </CustomerAuthProvider>
  );
}
