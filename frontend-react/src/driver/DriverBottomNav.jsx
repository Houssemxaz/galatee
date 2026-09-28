import { NavLink, Link } from "react-router-dom";
import { Bike, BarChart3, Home, LogOut } from "lucide-react";

export default function DriverBottomNav({ onLogout, showLogout = true }) {
  return (
    <nav className="pbg-drv-bottom-nav" aria-label="Navigation livreur">
      <NavLink to="/livreur" end className="pbg-drv-bottom-link">
        <Home size={18} strokeWidth={1.9} />
        <span>Accueil</span>
      </NavLink>
      <Link to="/livreur#courses-disponibles" className="pbg-drv-bottom-link">
        <Bike size={18} strokeWidth={1.9} />
        <span>Courses</span>
      </Link>
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
