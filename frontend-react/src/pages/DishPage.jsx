import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { fetchMenu } from "@/lib/api";

export default function DishPage() {
  const { slug } = useParams();
  const [dish, setDish] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    fetchMenu()
      .then((items) => {
        if (cancelled) return;
        const found = items.find((d) => d.slug === slug);
        if (found) { setDish(found); setState("ready"); }
        else { setState("notfound"); }
      })
      .catch(() => { if (cancelled) return; setState("error"); });
    return () => { cancelled = true; };
  }, [slug]);

  if (state === "loading") return <div className="page page-dish pbg-page pbg-page-cream"><div className="pbg-page-shell pbg-dish-status">Chargement du plat…</div></div>;
  if (state === "notfound") return (
    <div className="page page-dish pbg-page pbg-page-cream">
      <div className="pbg-page-shell pbg-dish-notfound">
        <h1 className="pbg-page-title">Plat introuvable</h1>
        <p className="pbg-page-lede">Ce plat n'est plus au menu de la semaine.</p>
        <Link to="/menu" className="pbg-btn pbg-btn-primary">
          <ArrowLeft size={14} strokeWidth={1.8} />
          <span>Retour à la carte</span>
        </Link>
      </div>
    </div>
  );
  if (state === "error") return <div className="page page-dish pbg-page pbg-page-cream"><div className="pbg-page-shell pbg-dish-status">Impossible de charger le plat.</div></div>;

  return (
    <div className="page page-dish pbg-page pbg-page-cream">
      <div className="pbg-page-shell pbg-dish-back">
        <Link to="/menu" className="pbg-dish-back-link">
          <ArrowLeft size={14} strokeWidth={1.8} />
          <span>Retour à la carte</span>
        </Link>
      </div>

      <section className="pbg-dish-hero">
        <Reveal className="pbg-dish-hero-media">
          <figure className="pbg-dish-figure">
            <img src={dish.image} alt={dish.alt} loading="eager" />
          </figure>
        </Reveal>
        <Reveal delay={120} className="pbg-dish-hero-copy">
          <span className="pbg-dish-page-label">{dish.label}</span>
          <h1 className="pbg-dish-page-title">{dish.title}</h1>
          <p className="pbg-dish-page-summary">{dish.summary}</p>
          <div className="pbg-dish-page-rule" aria-hidden="true" />
          <p className="pbg-dish-page-desc">{dish.description}</p>
          <div className="pbg-dish-page-actions">
            <Link to={`/commande?dish=${encodeURIComponent(dish.id)}`} className="pbg-btn pbg-btn-primary">
              <span>Commander ce plat</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
            <Link to="/menu" className="pbg-dish-back-link">
              <ArrowLeft size={14} strokeWidth={1.8} />
              <span>Voir les autres plats</span>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
