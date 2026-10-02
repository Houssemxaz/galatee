import { Navigate } from "react-router-dom";
import { Mail, Phone, MapPin, User } from "lucide-react";
import AccountSectionLayout from "./AccountSectionLayout";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export default function AccountProfilePage() {
  const { account, loading } = useCustomerAuth();
  if (loading) return null;
  if (!account) return <Navigate to="/compte" replace />;

  return (
    <AccountSectionLayout
      variant="bordeaux"
      index="01"
      eyebrow="Coordonnées"
      title="Votre"
      titleEm="carnet."
      lede="Les informations que la trattoria utilise pour vous joindre, préparer votre commande, ou livrer chez vous."
      seo={{
        title: "Mes coordonnées — Pasta by Galatée",
        description: "Vos coordonnées personnelles sur Pasta by Galatée.",
        path: "/compte/profil",
      }}
    >
      <div className="pbg-account-panel">
        <div className="pbg-account-panel-head">
          <span className="pbg-account-panel-icon"><User size={20} strokeWidth={1.5} /></span>
          <div>
            <p className="pbg-account-panel-eyebrow">Identité</p>
            <h2 className="pbg-account-panel-title">{account.firstName} {account.lastName}</h2>
          </div>
        </div>

        <ul className="pbg-account-panel-list">
          <li>
            <span className="pbg-account-panel-list-icon"><Mail size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Email</small>
              <strong>{account.email}</strong>
            </div>
          </li>
          <li>
            <span className="pbg-account-panel-list-icon"><Phone size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Téléphone</small>
              <strong>{account.phone}</strong>
            </div>
          </li>
          <li>
            <span className="pbg-account-panel-list-icon"><MapPin size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Commune de résidence</small>
              <strong>{account.residenceCommune || "Non renseignée"}</strong>
            </div>
          </li>
        </ul>

        <p className="pbg-account-panel-note">
          Pour modifier vos coordonnées, contactez la trattoria — nous mettons à jour le carnet manuellement pour l'instant.
        </p>
      </div>
    </AccountSectionLayout>
  );
}
