import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import BrandMarquee from "@/components/BrandMarquee";
import TiltCard from "@/components/TiltCard";
import ShineCTA from "@/components/ShineCTA";
import DishImage from "@/components/DishImage";
import SEO from "@/components/SEO";
import { fetchMenu, trackEvent } from "@/lib/api";

function MenuTeaserCard({ dish, index }) {
  return (
    <Reveal className="home-menu-card-reveal" delay={index * 80}>
      <TiltCard>
        <Link className="home-menu-card" to={`/menu/${dish.slug}`} aria-label={`Voir ${dish.title}`}>
          <div className="home-menu-card-media">
            <DishImage dish={dish} sizes="(max-width: 720px) 90vw, 33vw" />
            <span className="home-menu-card-cta"><ArrowUpRight size={14} strokeWidth={2} /> Voir la fiche</span>
          </div>
          <div className="home-menu-card-body">
            <span className="home-menu-card-label">{dish.label}</span>
            <h3 className="home-menu-card-title">{dish.title}</h3>
            <p className="home-menu-card-summary">{dish.summary}</p>
          </div>
        </Link>
      </TiltCard>
    </Reveal>
  );
}

const INFO_TEASERS = [
  { n: "01", label: "Horaires", value: "Mercredi — Samedi · 19h à 23h30" },
  { n: "02", label: "Livraison", value: "Alger centre · retrait ou livraison en 30 min" },
  { n: "03", label: "Groupes", value: "8 à 24 couverts · commande groupée sur demande" },
];

export default function HomePage() {
  const [dishes, setDishes] = useState([]);
  const [menuState, setMenuState] = useState("loading");
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMenu()
      .then((items) => { if (cancelled) return; setDishes(items); setMenuState(items.length ? "ready" : "empty"); })
      .catch(() => { if (cancelled) return; setMenuState("error"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = "/assets/brand/box-pomodoro-steam-960.webp";
    if (img.complete) {
      setHeroReady(true);
    } else {
      img.onload = () => setHeroReady(true);
      img.onerror = () => setHeroReady(true);
      const fallback = setTimeout(() => setHeroReady(true), 2500);
      return () => clearTimeout(fallback);
    }
    return undefined;
  }, []);

  const previewDishes = useMemo(() => dishes.slice(0, 3), [dishes]);

  return (
    <>
      <SEO
        title="Trattoria italienne à Hydra, Alger"
        description="Pasta by Galatée — Maison de pâtes fraîches à Hydra. Spaghetti pomodoro, carbonara, tiramisu maison. Livraison ou retrait du mercredi au samedi soir à Alger."
        path="/"
        imageAlt="Spaghetti pomodoro dans une box PASTA by Galatée"
      />
      {/* ═══ HERO v2 — Structure ancienne + box PASTA flottante + fond olive riche ═══ */}
      <section className={`home-hero pbg-hero-v3${heroReady ? " is-ready" : ""}`} id="top" aria-labelledby="home-hero-title">
        <div className="pbg-hero-bg-v3" aria-hidden="true">
          <div className="pbg-hero-grain-v3" />
        </div>

        <div className="pbg-hero-inner-v3">
          <div className="pbg-hero-object-v3" aria-hidden="true">
            <div className="pbg-hero-glow-v3" />
            <svg className="pbg-hero-steam-v3" viewBox="0 0 240 200" preserveAspectRatio="xMidYMax meet">
              <g fill="rgba(255,255,255,0.7)" style={{ filter: "blur(3px)" }}>
                <path d="M90 190 C 80 160 96 130 105 108 C 92 88 108 62 118 48 C 112 30 126 14 128 4">
                  <animate attributeName="opacity" values="0;0.75;0" dur="4s" repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="translate" values="0 30;0 0;0 -40" dur="4s" repeatCount="indefinite" />
                </path>
                <path d="M140 195 C 152 165 138 138 128 118 C 144 96 128 66 118 50 C 128 34 116 18 112 6">
                  <animate attributeName="opacity" values="0;0.6;0" dur="4.6s" begin="1.1s" repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="translate" values="0 30;0 -5;0 -45" dur="4.6s" begin="1.1s" repeatCount="indefinite" />
                </path>
                <path d="M115 200 C 108 175 118 152 122 132 C 108 110 122 86 128 68 C 122 54 130 40 132 24">
                  <animate attributeName="opacity" values="0;0.55;0" dur="5s" begin="2.2s" repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="translate" values="0 30;0 -10;0 -50" dur="5s" begin="2.2s" repeatCount="indefinite" />
                </path>
              </g>
            </svg>
            <picture>
              <source
                type="image/webp"
                srcSet="/assets/brand/box-pomodoro-steam-640.webp 640w, /assets/brand/box-pomodoro-steam-960.webp 960w"
                sizes="(max-width: 720px) 80vw, 42vw"
              />
              <img className="pbg-hero-box-img-v3" src="/assets/brand/box-pomodoro-steam.png" alt="Spaghetti pomodoro dans une box PASTA by Galatée avec basilic frais et vapeur" fetchPriority="high" decoding="async" onLoad={() => setHeroReady(true)} />
            </picture>
          </div>

          <div className="pbg-hero-copy-v3">
            <p className="pbg-hero-kicker">
              <span>— Maison de pâtes fraîches — Hydra</span>
            </p>
            <h1 className="pbg-hero-h1" id="home-hero-title">
              Bienvenue chez
              <br /><em>Pasta by Galatée<span className="pbg-hero-dot">.</span></em>
            </h1>
            <p className="pbg-hero-sub"><em>Ici, la pâte se roule à la main.</em></p>
            <p className="pbg-hero-desc">
              Des recettes simples, des ingrédients de qualité,<br />et beaucoup d'amour pour la vraie pasta.
            </p>
            <div className="pbg-hero-actions-v2">
              <ShineCTA
                as={Link}
                to="/commande"
                onClick={() => trackEvent("order_cta_clicked")}
                className="pbg-hero-cta-primary"
              >
                <span>Commander</span>
                <ArrowUpRight size={16} strokeWidth={1.8} />
              </ShineCTA>
              <Link className="pbg-hero-cta-ghost" to="/menu">
                <span>Voir le menu</span>
              </Link>
            </div>
          </div>
        </div>

      </section>

      <BrandMarquee />

      {/* ═══ 01 — MENU PREVIEW (cream) ═══ */}
      <section className="home-section home-menu pbg-section pbg-section-cream" id="home-menu" aria-labelledby="home-menu-title">
        <div className="page-shell">
          <Reveal className="pbg-section-head">
            <div className="pbg-section-index">
              <span>01</span><i />La carte
            </div>
            <div className="pbg-section-heading">
              <h2 id="home-menu-title" className="pbg-section-title">
                Fresh pasta,
                <br /><em>every day.</em>
              </h2>
              <p className="pbg-section-lede">Pâtes fraîches, sauces à la minute, garnitures de saison. Une carte courte, généreuse et vivante.</p>
            </div>
          </Reveal>

          <p className="pbg-menu-status" role="status" aria-live="polite">
            {menuState === "loading" && "Chargement du menu..."}
            {menuState === "error" && "Impossible de charger la carte pour le moment."}
            {menuState === "empty" && "La carte arrive très bientôt."}
            {menuState === "ready" && `${previewDishes.length} plats à découvrir cette semaine`}
          </p>

          <div className="home-menu-grid pbg-menu-grid">
            {previewDishes.map((dish, index) => (
              <MenuTeaserCard key={dish.id} dish={dish} index={index} />
            ))}
          </div>

          <Reveal className="pbg-section-foot" delay={200}>
            <Link to="/menu" className="pbg-btn pbg-btn-primary">
              <span>Voir toute la carte</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ 02 — COMMANDE TEASER (cream) ═══ */}
      <section className="home-section home-reservation pbg-section pbg-section-cream" id="home-order" aria-labelledby="home-order-title">
        <div className="page-shell">
          <Reveal className="pbg-reservation-inner">
            <div className="pbg-section-index"><span>02</span><i />La commande</div>
            <h2 id="home-order-title" className="pbg-section-title">
              Prenons
              <br /><em>le temps.</em>
            </h2>
            <p className="pbg-section-lede">Le service commence à 19h. Toute commande est confirmée par notre équipe sous 24h. Une envie particulière ? Glisse-la dans le formulaire.</p>
            <div className="pbg-reservation-meta">
              <div><span>Service</span><p>Mer — Sam</p></div>
              <div><span>Horaires</span><p>19h — 23h30</p></div>
              <div><span>Format</span><p>Livraison ou retrait</p></div>
            </div>
            <Link to="/commande" onClick={() => trackEvent("order_cta_clicked")} className="pbg-btn pbg-btn-primary">
              <span>Commander</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ 03 — INFORMATIONS TEASER ═══ */}
      <section className="home-section home-info-teaser pbg-section pbg-section-warm" id="home-info" aria-labelledby="home-info-title">
        <div className="page-shell">
          <Reveal className="pbg-section-head">
            <div className="pbg-section-index">
              <span>03</span><i />Informations
            </div>
            <div className="pbg-section-heading">
              <h2 id="home-info-title" className="pbg-section-title">
                Tout ce qu'il
                <br /><em>faut savoir.</em>
              </h2>
              <p className="pbg-section-lede">Horaires, commande, livraison, événements privés — les repères avant votre venue.</p>
            </div>
          </Reveal>

          <div className="pbg-info-list">
            {INFO_TEASERS.map((info, index) => (
              <Reveal key={info.n} className="pbg-info-line" delay={index * 80}>
                <span className="pbg-info-line-index">{info.n}</span>
                <span className="pbg-info-line-label">{info.label}</span>
                <span className="pbg-info-line-value">{info.value}</span>
              </Reveal>
            ))}
          </div>

          <Reveal className="pbg-section-foot" delay={300}>
            <Link to="/informations" className="pbg-btn pbg-btn-outline">
              <span>Toutes les informations</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ 04 — CONTACT ═══ */}
      <section className="home-section home-contact pbg-section pbg-section-tomato" id="home-contact" aria-labelledby="home-contact-title">
        <div className="page-shell">
          <Reveal className="pbg-contact-inner">
            <div className="pbg-section-index pbg-section-index-light">
              <span>04</span><i />Contact
            </div>
            <h2 id="home-contact-title" className="pbg-section-title pbg-section-title-light">
              Parlons-nous
              <br /><em>avant le service.</em>
            </h2>
            <p className="pbg-section-lede pbg-section-lede-light">Notre équipe vous répond du mercredi au samedi pour préparer votre venue, un dîner privé ou une attention particulière.</p>

            <div className="pbg-contact-channels">
              <a href="mailto:bonjour@galatee.dz" className="pbg-contact-channel">
                <span className="pbg-contact-channel-label">Email</span>
                <span className="pbg-contact-channel-value">bonjour@galatee.dz</span>
              </a>
              <div className="pbg-contact-channel">
                <span className="pbg-contact-channel-label">Téléphone</span>
                <span className="pbg-contact-channel-value">+213 · à confirmer</span>
              </div>
            </div>

            <Link to="/contact" className="pbg-btn pbg-btn-light">
              <span>Page contact complète</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
