function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export default function BusiestSlots({ slots }) {
  return (
    <section className="bo-stat-block" aria-labelledby="busiest-slots-title">
      <div className="bo-stat-block-heading">
        <div>
          <p className="bo-eyebrow">Organisation du service</p>
          <h3 id="busiest-slots-title">Créneaux les plus demandés</h3>
        </div>
        <p className="bo-stat-block-note">Commandes non annulées</p>
      </div>
      {!slots.length ? (
        <p className="bo-empty">Aucun créneau de commande sur cette période.</p>
      ) : (
        <div className="bo-slot-list">
          {slots.map((slot) => (
            <div className="bo-slot-row" key={`${slot.date}-${slot.time}`}>
              <span>{formatDate(slot.date)}</span>
              <strong>{slot.time}</strong>
              <span>{slot.orders} {slot.orders > 1 ? "commandes" : "commande"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
