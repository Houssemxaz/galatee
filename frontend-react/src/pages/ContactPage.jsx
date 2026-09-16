import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";

const CHANNELS = [
  {
    n: "01",
    label: "Téléphone",
    value: "+213 · à confirmer",
    href: "tel:+213000000000",
    note: "Réponse en direct — Mercredi au Samedi, 14h à 22h",
  },
  {
    n: "02",
    label: "Email",
    value: "bonjour@galatee.dz",
    href: "mailto:bonjour@galatee.dz",
    note: "Réponse écrite sous 24 heures ouvrées",
  },
  {
    n: "03",
    label: "Instagram",
    value: "@pasta.bygalatee",
    href: "https://www.instagram.com/pasta.bygalatee/",
    note: "Nouveautés, coulisses, moments de la trattoria",
  },
];

export default function ContactPage() {
  return (
    <div className="page page-contact pbg-page pbg-page-cream">
      <section className="pbg-page-header pbg-page-header-contact">
        <div className="pbg-page-shell">
          <p className="pbg-page-mark"><span>05</span><i /><em>Contact</em></p>
          <h1 className="pbg-page-title">
            Parlons-nous
            <br /><em>avant le service.</em>
          </h1>
          <p className="pbg-page-lede">Notre équipe vous répond du mercredi au samedi pour préparer votre venue, un dîner privé ou une attention particulière.</p>
          <div className="pbg-page-channels">
            <a href="tel:+213000000000"><span>Téléphone</span><strong>Réponse directe</strong></a>
            <a href="mailto:bonjour@galatee.dz"><span>Email</span><strong>Sous 24h</strong></a>
            <a href="https://www.instagram.com/pasta.bygalatee/" target="_blank" rel="noreferrer"><span>Instagram</span><strong>@pasta.bygalatee</strong></a>
          </div>
        </div>
      </section>

      <section className="pbg-page-shell pbg-contact-section">
        <div className="pbg-contact-directory-head">
          <p>Trois façons de nous trouver</p>
          <span>Réponse du mercredi au samedi</span>
        </div>
        {CHANNELS.map((channel, index) => (
          <Reveal key={channel.n} className="pbg-contact-row" delay={index * 90}>
            <div className="pbg-contact-row-index" aria-hidden="true">{channel.n}</div>
            <div className="pbg-contact-row-body">
              <p className="pbg-contact-row-label">{channel.label}</p>
              {channel.href ? (
                <a href={channel.href} target={channel.href.startsWith("http") ? "_blank" : undefined} rel={channel.href.startsWith("http") ? "noreferrer" : undefined} className="pbg-contact-row-value">{channel.value}</a>
              ) : (
                <span className="pbg-contact-row-value">{channel.value}</span>
              )}
              <p className="pbg-contact-row-note">{channel.note}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="pbg-page-shell pbg-contact-invite">
        <Reveal className="pbg-contact-invite-inner">
          <p className="pbg-contact-invite-kicker">Le prochain échange</p>
          <p className="pbg-contact-invite-lede">Une table qui vous ressemble —<br />préparée en quelques instants.</p>
          <Link to="/commande" className="pbg-btn pbg-btn-primary">
            <span>Commander</span>
            <ArrowUpRight size={16} strokeWidth={1.6} />
          </Link>
          <p className="pbg-contact-invite-meta">Mercredi — Samedi · dès 19h · Hydra, Alger</p>
        </Reveal>
      </section>
    </div>
  );
}
