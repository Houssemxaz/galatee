import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, PackageX } from "lucide-react";
import Reveal from "@/components/Reveal";
import PopCTA from "@/components/PopCTA";
import DishImage from "@/components/DishImage";
import SEO from "@/components/SEO";
import { fetchMenu } from "@/lib/api";
import { formatDzd } from "@/lib/formatters";

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

  const dishJsonLd = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "name": dish.title,
    "description": dish.description || dish.summary,
    "image": dish.image ? `https://galatee.dz${dish.image}` : undefined,
    "url": `https://galatee.dz/menu/${dish.slug}`,
    "offers": dish.priceCents ? {
      "@type": "Offer",
      "price": (dish.priceCents / 100).toFixed(2),
      "priceCurrency": "DZD",
      "availability": dish.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    } : undefined,
  };
  return (
    <div className="page page-dish pbg-page pbg-page-cream">
      <SEO
        title={`${dish.title} — ${dish.summary || "Pâtes fraîches"}`}
        description={dish.description || dish.summary || `${dish.title} — pâtes fraîches faites maison chez Pasta by Galatée, Hydra, Alger.`}
        path={`/menu/${dish.slug}`}
        image={dish.image ? `https://galatee.dz${dish.image}` : undefined}
        imageAlt={dish.alt}
        type="product"
        jsonLd={dishJsonLd}
      />
      <div className="pbg-page-shell pbg-dish-back">
        <Link to="/menu" className="pbg-dish-back-link">
          <ArrowLeft size={14} strokeWidth={1.8} />
          <span>Retour à la carte</span>
        </Link>
      </div>

      <section className="pbg-dish-hero">
        <Reveal className="pbg-dish-hero-media">
          <figure className="pbg-dish-figure">
            <DishImage dish={dish} sizes="(max-width: 900px) 100vw, 55vw" eager />
          </figure>
        </Reveal>
        <Reveal delay={120} className="pbg-dish-hero-copy">
          <span className="pbg-dish-page-label">{dish.label}</span>
          <div className="pbg-dish-page-title-row">
            <h1 className="pbg-dish-page-title">{dish.title}</h1>
            <strong className="pbg-dish-page-price">{formatDzd(dish.priceCents)}</strong>
          </div>
          <p className="pbg-dish-page-summary">{dish.summary}</p>
          <div className="pbg-dish-page-rule" aria-hidden="true" />
          <p className="pbg-dish-page-desc">{dish.description}</p>
          <div className="pbg-dish-page-actions">
            {dish.available ? (
              <PopCTA as={Link} to={`/commande?dish=${encodeURIComponent(dish.id)}`}>
                <span>Commander ce plat</span>
                <ArrowUpRight size={14} strokeWidth={2} />
              </PopCTA>
            ) : (
              <p className="pbg-dish-stock-status" role="status">
                <PackageX size={15} strokeWidth={1.8} />
                <span>Rupture de stock</span>
              </p>
            )}
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
