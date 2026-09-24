import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { useCart } from "@/context/CartContext";

const HIDDEN_PATHS = new Set(["/compte", "/commande", "/commande/coordonnees", "/table"]);

export default function FloatingOrderCTA() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const { count } = useCart();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (count <= 0) return undefined;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 520);
    return () => window.clearTimeout(t);
  }, [count]);

  if (HIDDEN_PATHS.has(location.pathname)) return null;

  const to = count > 0 ? "/commande" : "/menu";
  const label = count > 0 ? "Finaliser" : "Commander";

  return (
    <Link
      to={to}
      className={`floating-cta ${visible ? "is-visible" : ""} ${count > 0 ? "has-count" : ""}`}
      aria-label={count > 0 ? `Finaliser la commande, ${count} article${count > 1 ? "s" : ""}` : "Voir le menu et commander"}
    >
      <span className="floating-cta-icon"><ShoppingBag size={16} strokeWidth={1.9} /></span>
      <span className="floating-cta-label">{label}</span>
      {count > 0 && (
        <span className={`floating-cta-badge ${pulse ? "is-pulse" : ""}`} aria-hidden="true">
          {count}
        </span>
      )}
      <ArrowUpRight size={14} strokeWidth={1.9} />
    </Link>
  );
}
