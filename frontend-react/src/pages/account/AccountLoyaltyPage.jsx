import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Gift, Sparkles, Utensils, ArrowUpRight } from "lucide-react";
import AccountSectionLayout from "./AccountSectionLayout";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { fetchCustomerOrders } from "@/lib/api";

export default function AccountLoyaltyPage() {
  const { account, loading } = useCustomerAuth();
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    fetchCustomerOrders()
      .then((payload) => { if (!cancelled) setLoyalty(payload.loyalty || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [account]);

  if (loading) return null;
  if (!account) return <Navigate to="/compte" replace />;

  const threshold = loyalty?.settings?.threshold || 10;
  const reward = loyalty?.rewardAvailable;
  const progress = reward ? threshold : Math.min(threshold, loyalty?.progressInCycle || 0);
  const remaining = Math.max(0, threshold - progress);
  const percent = Math.min(100, (progress / threshold) * 100);
  const stamps = Array.from({ length: threshold }, (_, i) => i < progress);

  return (
    <AccountSectionLayout
      variant="tomato"
      index="02"
      eyebrow="Programme fidélité"
      title="Chaque plat"
      titleEm="compte."
      lede={reward
        ? "Votre récompense est débloquée — parlez-en à la trattoria lors de votre prochaine commande."
        : `Encore ${remaining} commande${remaining > 1 ? "s" : ""} et vous décrochez votre promo Galatée.`}
      seo={{
        title: "Fidélité — Pasta by Galatée",
        description: "Suivez votre progression fidélité chez Pasta by Galatée.",
        path: "/compte/fidelite",
      }}
    >
      <div className="pbg-account-panel pbg-account-loyalty-panel">
        <div className="pbg-account-loyalty-counter">
          <span className="pbg-account-loyalty-progress">{progress}</span>
          <span className="pbg-account-loyalty-slash">/</span>
          <span className="pbg-account-loyalty-total">{threshold}</span>
        </div>

        <div className="pbg-account-loyalty-track" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>

        <div className="pbg-account-loyalty-grid" role="img" aria-label={`${progress} commandes sur ${threshold}`}>
          {stamps.map((filled, i) => (
            <span key={i} className={`pbg-account-loyalty-stamp ${filled ? "is-filled" : ""}`}>
              <Utensils size={14} strokeWidth={2} />
            </span>
          ))}
        </div>

        <div className="pbg-account-loyalty-cta">
          {reward ? (
            <div className="pbg-account-loyalty-reward">
              <Gift size={18} strokeWidth={1.6} />
              <span>Récompense prête — mentionnez-le à la commande.</span>
            </div>
          ) : (
            <div className="pbg-account-loyalty-hint">
              <Sparkles size={16} strokeWidth={1.7} />
              <span>Chaque commande de plat ajoute un tampon à votre carte.</span>
            </div>
          )}
          <Link to="/commande" className="pbg-btn pbg-btn-light">
            <span>Commander maintenant</span>
            <ArrowUpRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </AccountSectionLayout>
  );
}
