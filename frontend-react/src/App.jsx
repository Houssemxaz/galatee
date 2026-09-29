import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TableModeBanner from "@/components/TableModeBanner";
import FloatingOrderCTA from "@/components/FloatingOrderCTA";
// Chemin critique de la commande : garde eager pour eviter tout flash.
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import OrderPage from "@/pages/OrderPage";
import CheckoutContactPage from "@/pages/CheckoutContactPage";
// Pages hors chemin critique : chargees a la demande. Meme regle pour
// DriverApp (PWA livreur autonome sous /livreur/*, jamais visitee depuis
// la home).
const DishPage = lazy(() => import("@/pages/DishPage"));
const InformationsPage = lazy(() => import("@/pages/InformationsPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const AccountPage = lazy(() => import("@/pages/AccountPage"));
const OrdersHistoryPage = lazy(() => import("@/pages/OrdersHistoryPage"));
const PastaLoverClubPage = lazy(() => import("@/pages/PastaLoverClubPage"));
const TableEntryPage = lazy(() => import("@/pages/TableEntryPage"));
const DriverApp = lazy(() => import("@/driver/DriverApp"));
import AccountProfilePage from "@/pages/account/AccountProfilePage";
import AccountLoyaltyPage from "@/pages/account/AccountLoyaltyPage";
import AccountPreferencesPage from "@/pages/account/AccountPreferencesPage";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { TableModeProvider } from "@/context/TableModeContext";
import { ToastProvider } from "@/context/ToastContext";
import { CartProvider } from "@/context/CartContext";
import { CheckoutFormProvider } from "@/context/CheckoutFormContext";
import { trackEvent } from "@/lib/api";

// Fallback discret pendant le chargement d un chunk de page. Volontairement
// silencieux visuellement : la plupart des chargements sont sub-seconde apres
// la premiere fois (le service worker + le cache HTTP servent instantanement).
function RouteFallback() {
  return <div aria-hidden="true" style={{ minHeight: "60vh" }} />;
}

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => { trackEvent("page_viewed"); }, [location.pathname]);
  return null;
}

// L espace livreur (/livreur/*) est une PWA autonome sans chrome du site public
// (pas de header, footer, cart context...). On l isole au niveau top-level.
function ClientSite() {
  return (
    <CustomerAuthProvider>
      <CartProvider>
      <CheckoutFormProvider>
      <ToastProvider>
      <TableModeProvider>
        <PageViewTracker />
        <div className="site-shell">
          <div className="site-grain" aria-hidden="true" />
          <a className="skip-link" href="#main-content">Aller au contenu</a>
          <SiteHeader />
          <TableModeBanner />
          <main id="main-content">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/table" element={<TableEntryPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/menu/:slug" element={<DishPage />} />
                <Route path="/commande" element={<OrderPage />} />
                <Route path="/commande/coordonnees" element={<CheckoutContactPage />} />
                <Route path="/pasta-lover-club" element={<PastaLoverClubPage />} />
                <Route path="/compte" element={<AccountPage />} />
                <Route path="/compte/profil" element={<AccountProfilePage />} />
                <Route path="/compte/fidelite" element={<AccountLoyaltyPage />} />
                <Route path="/compte/commandes" element={<OrdersHistoryPage />} />
                <Route path="/compte/preferences" element={<AccountPreferencesPage />} />
                <Route path="/informations" element={<InformationsPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <SiteFooter />
          <FloatingOrderCTA />
        </div>
      </TableModeProvider>
      </ToastProvider>
      </CheckoutFormProvider>
      </CartProvider>
    </CustomerAuthProvider>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/livreur/*" element={<DriverApp />} />
        <Route path="/*" element={<ClientSite />} />
      </Routes>
    </Suspense>
  );
}
