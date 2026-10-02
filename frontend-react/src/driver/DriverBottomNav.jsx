import { NavLink } from "react-router-dom";
import { BarChart3, Home, LogOut } from "lucide-react";

export default function DriverBottomNav({ onLogout, showLogout = true }) {
  return (
    <nav className="pbg-drv-bottom-nav" aria-label="Navigation livreur">
      <div className="pbg-drv-nav-brand" aria-label="Pasta by Galatée, espace livreur">
        <span className="pbg-drv-nav-brand-mark">P</span>
        <span className="pbg-drv-nav-brand-copy">
          <strong>Pasta by Galatée</strong>
          <small>Espace livreur</small>
        </span>
      </div>
      <NavLink to="/livreur" end className="pbg-drv-bottom-link">
        <Home size={18} strokeWidth={1.9} />
        <span>Accueil</span>
      </NavLink>
      <NavLink to="/livreur/stats" className="pbg-drv-bottom-link">
        <BarChart3 size={18} strokeWidth={1.9} />
        <span>Stats</span>
      </NavLink>
      {showLogout && (
        <button type="button" className="pbg-drv-bottom-link" onClick={onLogout}>
          <LogOut size={18} strokeWidth={1.9} />
          <span>Quitter</span>
        </button>
      )}
    </nav>
  );
}
