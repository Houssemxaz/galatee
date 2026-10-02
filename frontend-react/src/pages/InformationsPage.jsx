import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, Truck, Leaf, Sparkles, MapPin } from "lucide-react";
import Reveal from "@/components/Reveal";
import FaqSection from "@/components/FaqSection";
import SEO from "@/components/SEO";

export default function InformationsPage() {
  return (
    <div className="page page-info pbg-page pbg-page-cream">
      <SEO
        title="Informations — Horaires, livraison, groupes"
        description="Horaires, livraison à Alger, options sans gluten et végétariennes, événements privés — toutes les infos pour commander chez Pasta by Galatée à Hydra."
        path="/informations"
      />
      {/* ═══ HERO — olive dark (welcome + service info) ═══ */}
      <section className="pbg-section pbg-section-bordeaux pbg-info-hero">
        <div className="pbg-page-shell">
          <Reveal className="pbg-info-hero-head">
            <div className="pbg-section-index pbg-section-index-light">
              <span>04</span><i />Informations
            </div>
            <h1 className="pbg-info-hero-title">
              Tout ce qu'il
              <br /><em>faut savoir.</em>
            </h1>
            <p className="pbg-info-hero-lede">
              La trattoria est ouverte <b>du mercredi au samedi</b>, le soir uniquement. Dernière commande à 22h30 — fermeture à 23h30.
            </p>
          </Reveal>

          <div className="pbg-info-grid">
            <Reveal className="pbg-info-tile" delay={100}>
              <span className="pbg-info-tile-icon"><Clock3 size={20} strokeWidth={1.7} /></span>
              <p className="pbg-info-tile-label">Jours d'ouverture</p>
              <p className="pbg-info-tile-value">Mercredi — Samedi</p>
              <p className="pbg-info-tile-note">Fermé du dimanche au mardi</p>
            </Reveal>
            <Reveal className="pbg-info-tile" delay={180}>
              <span className="pbg-info-tile-icon"><Clock3 size={20} strokeWidth={1.7} /></span>
              <p className="pbg-info-tile-label">Horaires</p>
              <p className="pbg-info-tile-value">19h — 23h30</p>
              <p className="pbg-info-tile-note">Dernière commande à 22h30</p>
            </Reveal>
            <Reveal className="pbg-info-tile" delay={260}>
              <span className="pbg-info-tile-icon"><Sparkles size={20} strokeWidth={1.7} /></span>
              <p className="pbg-info-tile-label">Format</p>
              <p className="pbg-info-tile-value">Livraison ou retrait</p>
              <p className="pbg-info-tile-note">Confirmation par notre équipe sous 24h</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ 02 — RÉGIMES — sandy warm (soft) ═══ */}
      <section className="pbg-section pbg-section-warm pbg-info-diet">
        <div className="pbg-page-shell">
          <img
            className="pbg-info-diet-art"
            src="/assets/brand/ingredient-garlic-chili-oil.png"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
          <Reveal className="pbg-section-head">
            <div className="pbg-section-index"><span>02</span><i />La carte</div>
            <div className="pbg-section-heading">
              <h2 className="pbg-section-title">
                Régimes
                <br /><em>alimentaires.</em>
              </h2>
              <p className="pbg-section-lede">
                Options végétariennes à chaque service. Alternatives sans gluten sur la plupart des pâtes. Signalez vos allergies à la commande.
              </p>
            </div>
          </Reveal>

          <div className="pbg-info-diet-pills">
            <div className="pbg-info-diet-pill">
              <span className="pbg-info-diet-icon"><Leaf size={16} strokeWidth={1.8} /></span>
              <div>
                <p className="pbg-info-diet-name">Végétarien</p>
                <p className="pbg-info-diet-note">À chaque service, plusieurs choix</p>
              </div>
            </div>
            <div className="pbg-info-diet-pill">
              <span className="pbg-info-diet-icon"><Sparkles size={16} strokeWidth={1.8} /></span>
              <div>
                <p className="pbg-info-diet-name">Sans gluten</p>
                <p className="pbg-info-diet-note">Sur demande à la commande</p>
              </div>
            </div>
            <div className="pbg-info-diet-pill">
              <span className="pbg-info-diet-icon"><Truck size={16} strokeWidth={1.8} /></span>
              <div>
                <p className="pbg-info-diet-name">Allergies</p>
                <p className="pbg-info-diet-note">Champ « demande spéciale » à la commande</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 03 — ANNIVERSAIRES — tomato (strong) ═══ */}
      <section className="pbg-section pbg-section-tomato pbg-info-events">
        <div className="pbg-page-shell">
          <Reveal className="pbg-info-events-inner">
            <div className="pbg-section-index pbg-section-index-light">
              <span>03</span><i />Événements privés
            </div>
            <h2 className="pbg-section-title pbg-section-title-light">
              Anniversaires
              <br /><em>& soirées.</em>
            </h2>
            <p className="pbg-section-lede pbg-section-lede-light">
              La salle peut être privatisée les mercredis et jeudis soirs, de <b>8 à 24 couverts</b>. Anniversaires, dîners d'équipe, soirées privées — nous préparons une carte sur mesure. Contactez-nous au moins 10 jours à l'avance.
            </p>
            <div className="pbg-info-events-actions">
              <Link to="/contact" className="pbg-btn pbg-btn-light">
                <span>Nous écrire</span>
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </Link>
              <div className="pbg-info-events-meta">
                <span>Capacité</span><strong>8 à 24 couverts</strong>
              </div>
              <div className="pbg-info-events-meta">
                <span>Anticipation</span><strong>10 jours à l'avance</strong>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 04 — FAQ — sandy warm ═══ */}
      <section className="pbg-section pbg-section-warm pbg-info-faq">
        <div className="pbg-page-shell">
          <Reveal className="pbg-section-head">
            <div className="pbg-section-index">
              <span>04</span><i />Questions
            </div>
            <div className="pbg-section-heading">
              <h2 className="pbg-section-title">
                On répond
                <br /><em>à tout.</em>
              </h2>
              <p className="pbg-section-lede">
                Livraison, régimes, groupes, fidélité — les repères pour commander l'esprit léger.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <FaqSection />
          </Reveal>
        </div>
      </section>

      {/* ═══ 05 — HYDRA — cream soft closer ═══ */}
      <section className="pbg-section pbg-section-cream pbg-info-address-final pbg-info-address-final-cream">
        <div className="pbg-page-shell">
          <Reveal className="pbg-info-address-inner">
            <span className="pbg-info-address-pin"><MapPin size={18} strokeWidth={1.8} /></span>
            <div className="pbg-info-address-copy">
              <p className="pbg-info-address-eyebrow-final">Adresse</p>
              <p className="pbg-info-address-line-final">Hydra, Alger</p>
              <p className="pbg-info-address-note-final">L'adresse exacte est communiquée à la commande.</p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
