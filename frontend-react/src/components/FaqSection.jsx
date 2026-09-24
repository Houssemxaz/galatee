import { useState } from "react";

const DEFAULT_ITEMS = [
  {
    q: "Comment passer commande ?",
    a: "Choisissez vos plats depuis la carte, ajoutez-les au panier puis remplissez vos coordonnées. Notre équipe vous rappelle pour confirmer la commande sous 24h.",
  },
  {
    q: "Livrez-vous à toutes les communes d'Alger ?",
    a: "Nous livrons à Hydra, Ben Aknoun, El Biar, Bir Mourad Raïs, Kouba et Alger centre. Les frais varient selon la commune, choisissez la vôtre lors de la commande.",
  },
  {
    q: "Combien de temps à l'avance faut-il commander ?",
    a: "Commande le jour même possible jusqu'à 22h30. Pour un dîner à plusieurs (8+ couverts) ou une occasion, comptez 24h minimum.",
  },
  {
    q: "Proposez-vous des options sans gluten ou végétariennes ?",
    a: "Oui — plusieurs pâtes existent en version sans gluten, sur demande à la commande. La carte comporte toujours au moins un plat végétarien à chaque service.",
  },
  {
    q: "Comment fonctionne le programme fidélité ?",
    a: "Chaque commande confirmée compte. Au bout de 10 commandes, une récompense (plat offert, remise ou boisson) est débloquée automatiquement dans votre espace client.",
  },
  {
    q: "Peut-on privatiser la trattoria pour un événement ?",
    a: "Oui, les mercredis et jeudis soirs, pour 8 à 24 couverts (anniversaires, dîners d'équipe, soirées privées). Écrivez-nous au moins 10 jours à l'avance pour une carte sur mesure.",
  },
  {
    q: "Quels sont les modes de paiement ?",
    a: "Paiement à la livraison ou à la récupération uniquement, en espèces. Nous ne prenons pas de règlement en ligne.",
  },
  {
    q: "Puis-je manger sur place ?",
    a: "Non, la maison fonctionne uniquement en livraison ou retrait, du mercredi au samedi soir. Les événements privés sont l'exception, sur réservation.",
  },
];

function ChevronIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 260ms cubic-bezier(0.23, 1, 0.32, 1)" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function FaqSection({ items = DEFAULT_ITEMS, className = "" }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <ul className={`faq-list ${className}`}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <li key={i} className={`faq-item ${isOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="faq-trigger"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              onClick={() => setOpenIndex(isOpen ? -1 : i)}
            >
              <span className="faq-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="faq-question">{item.q}</span>
              <span className="faq-chevron"><ChevronIcon open={isOpen} /></span>
            </button>
            <div
              id={`faq-panel-${i}`}
              className="faq-panel"
              role="region"
              hidden={!isOpen}
            >
              <p className="faq-answer">{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
