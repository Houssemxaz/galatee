import Reveal from "@/components/Reveal";
import ReservationForm from "@/components/ReservationForm";

export default function ReservationPage() {
  return (
    <div className="page page-reservation pbg-page pbg-page-cream">
      <section className="pbg-page-header">
        <div className="pbg-page-shell">
          <p className="pbg-page-kicker"><span>Votre table chez Pasta by Galatée</span></p>
          <h1 className="pbg-page-title">
            Prenons
            <br /><em>le temps.</em>
          </h1>
          <p className="pbg-page-lede">Service à 19h. Une demande particulière ? Indiquez-la dans votre réservation — notre équipe vous répondra avec attention sous 24h.</p>
        </div>
      </section>

      <section className="pbg-page-shell pbg-reservation-block">
        <Reveal className="pbg-reservation-side">
          <p className="pbg-reservation-side-tag">Le chemin vers la table</p>
          <ol className="pbg-reservation-steps">
            <li>
              <span className="pbg-reservation-step-num">01</span>
              <div>
                <strong>Votre demande</strong>
                <small>Date, service, couverts.</small>
              </div>
            </li>
            <li>
              <span className="pbg-reservation-step-num">02</span>
              <div>
                <strong>Notre réponse</strong>
                <small>Sous 24h ouvrées.</small>
              </div>
            </li>
            <li>
              <span className="pbg-reservation-step-num">03</span>
              <div>
                <strong>Votre table</strong>
                <small>Confirmée à Hydra.</small>
              </div>
            </li>
          </ol>
          <ul className="pbg-reservation-side-list">
            <li><span>Service</span> Mer — Sam</li>
            <li><span>Horaires</span> 19h — 23h30</li>
            <li><span>Événements</span> Sur demande</li>
          </ul>
        </Reveal>
        <Reveal className="pbg-reservation-form-wrap" delay={100}>
          <ReservationForm />
        </Reveal>
      </section>
    </div>
  );
}
