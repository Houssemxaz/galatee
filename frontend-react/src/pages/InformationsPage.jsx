import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";

const SECTIONS = [
  {
    n: "01",
    eyebrow: "Le service",
    title: "Horaires détaillés",
    body: (
      <>
        <p>La trattoria est ouverte <b>du mercredi au samedi</b>, le soir uniquement.</p>
        <p>Dernière commande à 22h30 · fermeture à 23h30. Nous fermons du dimanche au mardi.</p>
      </>
    ),
    meta: [
      { label: "Ouverture", value: "Mer — Sam" },
      { label: "Horaires", value: "19h — 23h30" },
    ],
  },
  {
    n: "02",
    eyebrow: "Votre commande",
    title: "Commande & livraison",
    body: (
      <>
        <p>Toute commande est <b>confirmée par notre équipe</b> — réponse sous 24h.</p>
        <p>Annulation gratuite jusqu'à 6h avant le service.</p>
        <p>Livraison à Alger centre en 30 minutes, retrait direct sur place.</p>
      </>
    ),
    meta: [
      { label: "Confirmation", value: "Sous 24h" },
      { label: "Livraison", value: "Alger, 30 min" },
    ],
  },
  {
    n: "03",
    eyebrow: "La carte",
    title: "Régimes alimentaires",
    body: (
      <>
        <p>Notre carte comporte des <b>options végétariennes</b> à chaque service.</p>
        <p>Alternatives <b>sans gluten</b> possibles sur la plupart des pâtes — prévenez-nous à la commande.</p>
        <p>Allergies : indiquez-les dans le champ « demande spéciale ».</p>
      </>
    ),
    meta: [
      { label: "Végé", value: "À chaque service" },
      { label: "Sans gluten", value: "Sur demande" },
    ],
  },
  {
    n: "04",
    eyebrow: "Événements privés",
    title: "Anniversaires & soirées",
    body: (
      <>
        <p>La salle peut être <b>privatisée</b> les mercredis et jeudis soirs pour des groupes de <b>8 à 24 couverts</b>.</p>
        <p>Anniversaires, dîners d'équipe, soirées — nous préparons une <b>carte sur mesure</b>.</p>
        <p>Contactez-nous au moins 10 jours à l'avance.</p>
      </>
    ),
    meta: [
      { label: "Capacité", value: "8 à 24 couverts" },
      { label: "Commande", value: "10 jours à l'avance" },
    ],
    cta: true,
  },
];

export default function InformationsPage() {
  return (
    <div className="page page-info pbg-page pbg-page-cream">
      <section className="pbg-page-header pbg-page-header-info">
        <div className="pbg-page-shell">
          <p className="pbg-page-mark"><span>04</span><i /><em>Informations</em></p>
          <h1 className="pbg-page-title">
            Tout ce qu'il
            <br /><em>faut savoir.</em>
          </h1>
          <p className="pbg-page-lede">Horaires, commande, livraison, régimes, événements — les repères avant votre venue chez Pasta by Galatée.</p>
          <div className="pbg-page-highlights">
            <div><span>Service</span><strong>Mer — Sam</strong></div>
            <div><span>Horaires</span><strong>19h — 23h30</strong></div>
            <div><span>Livraison</span><strong>Alger, 30 min</strong></div>
          </div>
        </div>
      </section>

      <section className="pbg-page-shell pbg-info-section">
        <div className="pbg-info-directory-head">
          <p>Les repères de votre venue</p>
          <span>Mis à jour à chaque service</span>
        </div>
        {SECTIONS.map((section, index) => (
          <Reveal key={section.n} className="pbg-info-row" delay={index * 60}>
            <div className="pbg-info-row-index" aria-hidden="true">{section.n}</div>
            <div className="pbg-info-row-body">
              <p className="pbg-info-row-eyebrow"><i /><span>{section.eyebrow}</span></p>
              <h2 className="pbg-info-row-title">{section.title}</h2>
              <div className="pbg-info-row-text">{section.body}</div>
              <dl className="pbg-info-row-meta">
                {section.meta.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{m.value}</dd>
                  </div>
                ))}
              </dl>
              {section.cta && (
                <Link to="/contact" className="pbg-btn pbg-btn-primary pbg-info-row-cta">
                  <span>Nous écrire pour préparer votre soirée</span>
                  <ArrowUpRight size={16} strokeWidth={1.5} />
                </Link>
              )}
            </div>
          </Reveal>
        ))}
      </section>

      <section className="pbg-page-shell pbg-info-address">
        <div className="pbg-info-address-inner">
          <p className="pbg-info-address-eyebrow"><i /><span>Adresse</span></p>
          <p className="pbg-info-address-line">Hydra, Alger</p>
          <p className="pbg-info-address-note">Adresse exacte communiquée à la commande.</p>
        </div>
      </section>
    </div>
  );
}
