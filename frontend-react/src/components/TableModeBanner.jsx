import { Link } from "react-router-dom";
import { ArrowUpRight, X } from "lucide-react";
import { useTableMode } from "@/context/TableModeContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export default function TableModeBanner() {
  const { active, bannerDismissed, dismissBanner } = useTableMode();
  const { account, loading } = useCustomerAuth();

  if (!active || bannerDismissed) return null;
  if (loading || account) return null;

  return (
    <div className="tm-banner" role="region" aria-label="Offre fidélité">
      <div className="tm-banner-inner">
        <div className="tm-banner-copy">
          <p className="tm-banner-kicker">🍝 Bienvenue à table — Hydra</p>
          <p className="tm-banner-lede">
            Créez votre compte pour profiter de <strong>−10 % de fidélité</strong> sur votre première commande.
          </p>
        </div>
        <div className="tm-banner-actions">
          <Link to="/compte?mode=signup" className="tm-banner-cta">
            <span>Créer un compte</span>
            <ArrowUpRight size={16} strokeWidth={1.8} />
          </Link>
          <button
            type="button"
            className="tm-banner-close"
            aria-label="Fermer le message"
            onClick={dismissBanner}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}
