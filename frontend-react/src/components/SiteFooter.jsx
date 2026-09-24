import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import FlipSocial from "@/components/FlipSocial";
import { useTableMode } from "@/context/TableModeContext";

const SOCIAL_ITEMS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/pasta.bygalatee/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@pasta.bygalatee",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 8.5a7 7 0 0 1-5-2v9a5 5 0 1 1-5-5" />
        <path d="M16 3v3.5" />
      </svg>
    ),
  },
  {
    label: "Snapchat",
    href: "https://www.snapchat.com/add/pasta.bygalatee",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c3.5 0 5.5 2.5 5.5 6c0 2 .5 3.5 1.5 4.5c.7.7 1.5 1 2.5 1c-.5 1-2 1.5-3 1.5c-.5 1.5-.5 3-2 3c-1 0-1.5-.5-2.5-.5c-1 0-1.5.5-2 .5c-.5 0-1-.5-2-.5s-1.5.5-2.5.5c-1.5 0-1.5-1.5-2-3c-1 0-2.5-.5-3-1.5c1 0 1.8-.3 2.5-1c1-1 1.5-2.5 1.5-4.5C6.5 5.5 8.5 3 12 3z" />
      </svg>
    ),
  },
];

export default function SiteFooter() {
  const { active: tableMode } = useTableMode();
  return (
    <footer className={`site-foot ${tableMode ? "site-foot-compact" : ""}`}>
      <div className="site-foot-inner">
        <div className="site-foot-brand">
          <Link to={tableMode ? "/menu" : "/"} className="site-foot-logo-link" aria-label="Pasta by Galatée, accueil">
            <BrandLogo className="site-foot-logo" />
          </Link>
          <p className="site-foot-signature">Pasta. Music. Memories.</p>
          <p className="site-foot-address">Hydra, Alger — Pâtes fraîches faites maison</p>
        </div>
        {!tableMode && (
          <nav className="site-foot-links" aria-label="Navigation pied de page">
            <Link to="/menu">Menu</Link>
            <Link to="/commande">Commander</Link>
            <Link to="/pasta-lover-club">Pasta Lover Club</Link>
            <Link to="/informations">Informations</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/compte">Espace client</Link>
          </nav>
        )}
        {tableMode && (
          <nav className="site-foot-links" aria-label="Navigation pied de page">
            <Link to="/menu">Menu</Link>
            <Link to="/commande">Commander</Link>
            <Link to="/compte">Mon compte</Link>
          </nav>
        )}
        <div className="site-foot-social" aria-label="Réseaux sociaux">
          <FlipSocial items={SOCIAL_ITEMS} />
        </div>
        <div className="site-foot-meta">
          <span>© 2026 Pasta by Galatée — Hydra, Alger</span>
        </div>
      </div>
    </footer>
  );
}
