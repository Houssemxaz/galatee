import { useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu, UserRound, X } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useTableMode } from "@/context/TableModeContext";
import BrandLogo from "@/components/BrandLogo";

const NAV_ITEMS = [
  { to: "/menu", label: "Menu" },
  { to: "/commande", label: "Commander" },
  { to: "/pasta-lover-club", label: "Club" },
  { to: "/informations", label: "Informations" },
  { to: "/contact", label: "Contact" },
];

const TABLE_MODE_KEYS = new Set(["/menu", "/commande", "/pasta-lover-club"]);

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const location = useLocation();
  const { account, loading, logout } = useCustomerAuth();
  const { active: tableMode } = useTableMode();
  const navItems = useMemo(() => (
    tableMode ? NAV_ITEMS.filter((item) => TABLE_MODE_KEYS.has(item.to)) : NAV_ITEMS
  ), [tableMode]);
  const homeHref = tableMode ? "/menu" : "/";

  useEffect(() => {
    let ticking = false;
    const handle = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      // Keep the navigation visible only at the top of the page.
      setHidden(y >= 80);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(handle);
        ticking = true;
      }
    };
    handle();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On route change, ensure nav is visible again
  useEffect(() => { setHidden(false); }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("nav-open"); };
  }, [open]);

  return (
    <>
      <header className={`site-nav ${scrolled ? "is-scrolled" : ""} ${hidden ? "is-hidden" : ""}`} data-route={location.pathname}>
        <div className="site-nav-inner">
          <Link to={homeHref} className="site-nav-mark" aria-label="Pasta by Galatée, accueil">
            <BrandLogo className="site-nav-logo" />
          </Link>
          <nav className="site-nav-links" aria-label="Navigation principale">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `site-nav-link ${isActive ? "is-active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          {!loading && (
            <div className="site-nav-account" aria-label="Espace client">
              {account ? <><Link to="/compte" className="site-nav-account-link"><UserRound size={14} /> Mon compte</Link><button type="button" className="site-nav-account-logout" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={14} /></button></> : <><Link to="/compte?mode=login" className="site-nav-account-link">Se connecter</Link><Link to="/compte?mode=signup" className="site-nav-account-cta">Créer un compte <ArrowUpRight size={14} /></Link></>}
            </div>
          )}
          <button
            className="site-nav-burger"
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
          >
            {open ? <X size={18} strokeWidth={1.6} /> : <Menu size={18} strokeWidth={1.6} />}
          </button>
        </div>
      </header>
      <div className={`site-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <nav aria-label="Navigation mobile">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `site-drawer-link ${isActive ? "is-active" : ""}`}>
              <span>{item.label}</span>
              <span aria-hidden="true">→</span>
            </NavLink>
          ))}
        </nav>
        {!loading && <div className="site-drawer-account"><p className="site-drawer-account-label">Espace client</p>{account ? <><Link to="/compte" className="site-drawer-account-link"><UserRound size={15} /> Mon compte <ArrowUpRight size={14} /></Link><button type="button" className="site-drawer-account-link" onClick={logout}><LogOut size={15} /> Se déconnecter <ArrowUpRight size={14} /></button></> : <><Link to="/compte?mode=login" className="site-drawer-account-link"><UserRound size={15} /> Se connecter <ArrowUpRight size={14} /></Link><Link to="/compte?mode=signup" className="site-drawer-account-link"><UserRound size={15} /> Créer un compte <ArrowUpRight size={14} /></Link></>}</div>}
        <div className="site-drawer-foot">
          <p>Hydra, Alger</p>
          <p>Mercredi — Samedi · dès 19h</p>
        </div>
      </div>
    </>
  );
}
