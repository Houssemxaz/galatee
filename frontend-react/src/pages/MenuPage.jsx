import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import DishImage from "@/components/DishImage";
import SEO from "@/components/SEO";
import { fetchMenu, categories, trackEvent } from "@/lib/api";

export default function MenuPage() {
  const [dishes, setDishes] = useState([]);
  const [state, setState] = useState("loading");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchMenu()
      .then((items) => { if (cancelled) return; setDishes(items); setState(items.length ? "ready" : "empty"); })
      .catch(() => { if (cancelled) return; setState("error"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { trackEvent("menu_viewed"); }, []);

  const filtered = useMemo(
    () => (category === "all" ? dishes : dishes.filter((d) => d.category === category)),
    [category, dishes],
  );

  const menuJsonLd = dishes.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "Menu",
    "name": "La carte Pasta by Galatée",
    "hasMenuSection": {
      "@type": "MenuSection",
      "name": "Nos plats",
      "hasMenuItem": dishes.map((dish) => ({
        "@type": "MenuItem",
        "name": dish.title,
        "description": dish.summary,
        "image": dish.image ? `https://galatee.dz${dish.image}` : undefined,
        "offers": dish.priceCents ? {
          "@type": "Offer",
          "price": (dish.priceCents / 100).toFixed(2),
          "priceCurrency": "DZD",
        } : undefined,
      })),
    },
  } : undefined;

  return (
    <div className="page page-menu pbg-page pbg-page-cream">
      <SEO
        title="La carte — Pâtes fraîches quotidiennes"
        description="Découvrez la carte Pasta by Galatée : spaghetti pomodoro, carbonara, tiramisu maison et pâtes fraîches préparées le matin. Livraison et retrait à Alger."
        path="/menu"
        jsonLd={menuJsonLd}
      />
      <section className="pbg-page-header" data-page-number="02">
        <div className="pbg-page-shell">
          <p className="pbg-page-kicker"><span>La carte</span></p>
          <h1 className="pbg-page-title">
            Fresh pasta,
            <br /><em>every day.</em>
          </h1>
          <p className="pbg-page-lede">Pâtes fraîches préparées le matin même. Sauces à la minute. Une carte courte, généreuse et vivante, qui suit la saison.</p>
        </div>
      </section>

      <section className="pbg-page-shell pbg-menu-section">
        <div className="pbg-menu-toolbar">
          <div className="pbg-menu-filter" role="group" aria-label="Filtrer le menu">
            {categories.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`pbg-menu-chip ${category === item.value ? "is-active" : ""}`}
                aria-pressed={category === item.value}
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="pbg-menu-status" role="status" aria-live="polite">
            {state === "loading" && "Chargement…"}
            {state === "error" && "Impossible de charger."}
            {state === "empty" && "Publication à venir."}
            {state === "ready" && `${filtered.length} ${filtered.length > 1 ? "plats" : "plat"} au menu`}
          </p>
        </div>

        <div className="pbg-dish-grid" aria-live="polite" key={category} data-menu-grid>
          {filtered.map((dish, index) => (
            <Link
              key={dish.slug}
              to={`/menu/${dish.slug}`}
              className="pbg-dish-card pbg-dish-card-anim"
              style={{ "--stagger": `${index * 60}ms` }}
            >
              <div className="pbg-dish-card-media">
                <DishImage dish={dish} sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw" />
              </div>
              <div className="pbg-dish-card-body">
                <span className="pbg-dish-card-label">{dish.label}</span>
                <h2 className="pbg-dish-card-title">{dish.title}</h2>
                <p className="pbg-dish-card-summary">{dish.summary}</p>
                <span className="pbg-dish-card-cta">
                  <span>Voir le plat</span>
                  <ArrowUpRight size={14} strokeWidth={1.8} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
