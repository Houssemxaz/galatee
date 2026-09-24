import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

export default function NotFoundPage() {
  return (
    <div className="page page-notfound">
      <SEO
        title="Page introuvable — 404"
        description="Cette page n'existe pas ou a été déplacée. Retour à Pasta by Galatée, trattoria à Hydra, Alger."
        path="/404"
        noIndex
      />
      <div className="page-shell page-notfound-inner">
        <p className="page-kicker"><i /><span>Erreur 404</span></p>
        <h1 className="page-title">Cette page<br /><em>n'existe pas.</em></h1>
        <p className="page-lede">Le lien est peut-être ancien, ou la page a été déplacée.</p>
        <Link to="/" className="action-button"><ArrowLeft size={14} /><span>Retour à l'accueil</span></Link>
      </div>
    </div>
  );
}
