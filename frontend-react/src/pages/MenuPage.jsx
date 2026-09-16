import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";
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

  return (
    <div className="page page-menu pbg-page pbg-page-cream">
      <section className="pbg-page-header">
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

        <div className="pbg-dish-grid" aria-live="polite">
          {filtered.map((dish, index) => (
            <Reveal key={dish.slug} delay={index * 80}>
              <Link to={`/menu/${dish.slug}`} className="pbg-dish-card">
                <div className="pbg-dish-card-media">
                  <img src={dish.image} alt={dish.alt} loading="lazy" decoding="async" />
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
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
