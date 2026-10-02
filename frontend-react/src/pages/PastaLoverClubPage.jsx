import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, Sparkles, Star, Ticket, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import Reveal from "@/components/Reveal";
import ShineCTA from "@/components/ShineCTA";
import GlowCard from "@/components/GlowCard";
import SEO from "@/components/SEO";
import { fetchPastaLoverClub } from "@/lib/api";

export default function PastaLoverClubPage() {
  const [content, setContent] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    fetchPastaLoverClub()
      .then((payload) => { setContent(payload); setState("ready"); })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") return <div className="page page-club"><div className="pbg-page-shell pbg-dish-status">Chargement du club…</div></div>;
  if (state === "error" || !content) return <div className="page page-club"><div className="pbg-page-shell pbg-dish-status">Le club n'est pas disponible pour le moment.</div></div>;

  const { settings, events } = content;
  const benefits = (settings.benefits || "").split("\n").filter(Boolean);

  return (
    <div className="page page-club">
      <SEO
        title="Pasta Lover Club — Le cercle des habitués"
        description="Rejoignez le Pasta Lover Club de Galatée : invitations privées, ateliers pâtes fraîches, avant-premières menu et remise membre à chaque commande."
        path="/pasta-lover-club"
      />
      {/* ═══ 01 — INTRO — split éditorial ═══ */}
      <section className="club-section club-section-intro">
        <div className="pbg-page-shell club-intro-shell">
          <img
            className="club-signature-art club-signature-art-headphones"
            src="/assets/brand/club-vinyl-headphones.png"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
          <Reveal className="club-intro-copy">
            <p className="club-intro-kicker"><UsersRound size={13} strokeWidth={2} /> La communauté Galatée</p>
            <h1 className="club-intro-title">
              Pasta Lover
              <br /><em>Club.</em>
            </h1>
            <p className="club-intro-lede">{settings.intro}</p>
            <a href="#club-perks" className="club-intro-scroll" aria-label="Voir les avantages">
              <span>Découvrir les avantages</span>
              <ArrowUpRight size={14} strokeWidth={2} />
            </a>
            <ul className="club-intro-highlights" aria-label="Avantages du Pasta Lover Club">
              <li><span>01</span> Invitations privées</li>
              <li><span>02</span> Ateliers pâtes fraîches</li>
              <li><span>03</span> Avant-premières menu</li>
            </ul>
          </Reveal>

          <Reveal className="club-membership-card" delay={140}>
            <div className="club-membership-inner">
              <header className="club-membership-head">
                <p className="club-membership-eyebrow"><Sparkles size={11} strokeWidth={2} /> Carte membre</p>
                <p className="club-membership-serial">— 0001 —</p>
              </header>

              <div className="club-membership-title">
                <p className="club-membership-cursive">Pasta by Galatée</p>
                <p className="club-membership-name">Pasta Lover Club</p>
              </div>

              <div className="club-membership-perks">
                <p><Ticket size={12} strokeWidth={2} /> Invitations privées</p>
                <p><Sparkles size={12} strokeWidth={2} /> Ateliers pâtes fraîches</p>
                <p><Star size={12} strokeWidth={2} /> Avant-premières menu</p>
              </div>

              <footer className="club-membership-foot">
                <span>Depuis 2026</span>
                <span>Hydra · Alger</span>
              </footer>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 02 — LES AVANTAGES — olive dark ═══ */}
      <section className="club-section club-section-perks" id="club-perks">
        <div className="pbg-page-shell">
          <Reveal className="club-mini-head">
            <p className="club-mini-kicker">Le cercle · 02</p>
            <h2 className="club-mini-title">{settings.title}</h2>
          </Reveal>

          <div className="club-perks-grid">
            {benefits.map((benefit, i) => (
              <Reveal className="club-perk-card" key={benefit} delay={i * 80}>
                <span className="club-perk-index">0{i + 1}</span>
                <span className="club-perk-icon"><Sparkles size={18} strokeWidth={1.7} /></span>
                <p className="club-perk-text">{benefit}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 03 — L'AGENDA — sandy vert basilic ═══ */}
      <section className="club-section club-section-agenda">
        <div className="pbg-page-shell">
          <Reveal className="club-mini-head">
            <p className="club-mini-kicker">Les rendez-vous · 03</p>
            <h2 className="club-mini-title">À l'agenda.</h2>
            <p className="club-mini-lede">Ateliers, dîners privés, lancements de saison — les moments qui rythment l'année du club.</p>
          </Reveal>

          {events.length ? (
            <div className="club-agenda-list">
              {events.map((event, i) => {
                const CardWrapper = i === 0 ? GlowCard : "article";
                return (
                  <CardWrapper key={event.id} className={`club-event-card ${i === 0 ? "is-featured" : ""}`}>
                    <div className="club-event-body">
                      {i === 0 && <span className="club-event-badge">Prochaine date</span>}
                      <p className="club-event-date"><CalendarDays size={13} strokeWidth={2} /> {event.eventDate || "Bientôt"}</p>
                      <h3 className="club-event-title">{event.title}</h3>
                      <p className="club-event-desc">{event.description}</p>
                    </div>
                    {event.location && (
                      <div className="club-event-meta">
                        <span><MapPin size={13} strokeWidth={2} /> {event.location}</span>
                      </div>
                    )}
                  </CardWrapper>
                );
              })}
            </div>
          ) : (
            <div className="club-agenda-empty">
              <p>Les prochains rendez-vous seront annoncés ici.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══ 04 — CTA — cream terracotta ═══ */}
      <section className="club-section club-section-cta">
        <div className="pbg-page-shell">
          <Reveal className="club-cta-inner">
            <p className="club-mini-kicker">Rejoindre · 04</p>
            <h2 className="club-cta-title">
              Une envie
              <br /><em>de nous rejoindre ?</em>
            </h2>
            <p className="club-cta-lede">L'équipe vous répond du mercredi au samedi pour vous inscrire et vous proposer les prochains rendez-vous.</p>
            <ShineCTA as={Link} to="/contact" className="pbg-btn pbg-btn-primary">
              <span>Parler à l'équipe</span>
              <ArrowUpRight size={16} strokeWidth={1.8} />
            </ShineCTA>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
