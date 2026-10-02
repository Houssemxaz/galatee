import { Navigate, Link } from "react-router-dom";
import { LogOut, ShieldCheck, Cookie, ArrowUpRight } from "lucide-react";
import AccountSectionLayout from "./AccountSectionLayout";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export default function AccountPreferencesPage() {
  const { account, loading, logout } = useCustomerAuth();
  if (loading) return null;
  if (!account) return <Navigate to="/compte" replace />;

  return (
    <AccountSectionLayout
      variant="ink"
      index="04"
      eyebrow="Préférences"
      title="Confidentialité"
      titleEm="& session."
      lede="Gérez la façon dont Galatée conserve votre session, et retrouvez les liens vers nos conditions."
      seo={{
        title: "Préférences — Pasta by Galatée",
        description: "Préférences de votre compte Pasta by Galatée.",
        path: "/compte/preferences",
      }}
    >
      <div className="pbg-account-panel">
        <div className="pbg-account-panel-head">
          <span className="pbg-account-panel-icon"><ShieldCheck size={20} strokeWidth={1.5} /></span>
          <div>
            <p className="pbg-account-panel-eyebrow">Session</p>
            <h2 className="pbg-account-panel-title">Rester connecté</h2>
          </div>
        </div>

        <p className="pbg-account-panel-body">
          Votre session est conservée pendant 30 jours sur cet appareil. Se déconnecter efface uniquement cette session locale — votre compte reste intact.
        </p>

        <button type="button" className="pbg-account-logout-btn" onClick={logout}>
          <LogOut size={16} strokeWidth={1.7} />
          <span>Se déconnecter</span>
        </button>
      </div>

      <div className="pbg-account-panel">
        <div className="pbg-account-panel-head">
          <span className="pbg-account-panel-icon"><Cookie size={20} strokeWidth={1.5} /></span>
          <div>
            <p className="pbg-account-panel-eyebrow">Données</p>
            <h2 className="pbg-account-panel-title">Cookies & privé</h2>
          </div>
        </div>

        <p className="pbg-account-panel-body">
          Nous conservons uniquement les données nécessaires à votre commande et au programme fidélité — jamais de tracking publicitaire.
        </p>

        <Link to="/contact" className="pbg-account-panel-link">
          <span>Question sur mes données ?</span>
          <ArrowUpRight size={14} strokeWidth={1.7} />
        </Link>
      </div>
    </AccountSectionLayout>
  );
}
