import { useState } from "react";
import { Check, Crosshair, ExternalLink, Link2, MapPin, X } from "lucide-react";
import { useGeolocation } from "@/context/GeolocationContext";
import { coordinatesMapsUrl, isInDeliveryArea, parseGoogleMapsLink } from "@/lib/googleMapsLink";
import "./DeliveryLocationPicker.css";

// Aide le livreur a trouver l entree, sans carte. Deux informations
// independantes, toutes deux optionnelles :
//   - deliveryMapsUrl : lien Google Maps colle par le client (priorite n°1,
//     le livreur l ouvre tel quel) ;
//   - deliveryLatitude / deliveryLongitude : position exacte du telephone
//     (priorite n°2, permission deja demandee a l arrivee, cf. GeolocationContext).
// Sans l un ni l autre, le livreur utilise l adresse + la commune (lib/maps.js).

// Au-dela, on previent le client que sa position est approximative.
const LOW_ACCURACY_M = 60;
// Au-dela, la position n est pas enregistree : c est une estimation par le
// reseau (ordinateur sans GPS, GPS coupe), souvent fausse de plusieurs km.
const MAX_ACCURACY_M = 200;

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(".", ",")} km` : `${meters} m`;
}

const GEO_ERRORS = {
  denied: "Localisation refusée. Autorisez-la dans les réglages du navigateur, ou collez un lien Google Maps.",
  unavailable: "La localisation n'est pas disponible sur ce navigateur. Collez plutôt un lien Google Maps.",
  error: "Position introuvable pour le moment. Réessayez dans un instant, ou collez un lien Google Maps.",
};

function formatPoint(latitude, longitude) {
  return `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`;
}

function OpenLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pbg-loc-verify">
      {children} <ExternalLink size={12} strokeWidth={2} />
    </a>
  );
}

function LinkFeedback({ result, applied, onApply }) {
  if (result.status === "empty") return null;

  if (!result.url) {
    const message = result.status === "out-of-area"
      ? `Ce point (${formatPoint(result.latitude, result.longitude)}) est en dehors de notre zone de livraison à Alger. Vérifiez le lien.`
      : "Lien non reconnu. Collez un lien Google Maps (https://www.google.com/maps/… ou https://maps.app.goo.gl/…) ou des coordonnées, ou utilisez votre position exacte.";
    return <p className="pbg-loc-feedback is-error" role="status">{message}</p>;
  }

  return (
    <div className="pbg-loc-feedback is-ok" role="status">
      {result.status === "ok" && (
        <p>Point détecté : <b>{formatPoint(result.latitude, result.longitude)}</b></p>
      )}
      {result.status === "short-link" && (
        <p>Lien court Google Maps reconnu. Nous ne pouvons pas lire le point qu'il contient : ouvrez-le pour vérifier qu'il mène bien à votre entrée.</p>
      )}
      {result.status === "no-coordinates" && (
        <p>Lien Google Maps reconnu, sans coordonnées visibles. Ouvrez-le pour vérifier qu'il mène à votre entrée, pas seulement au quartier.</p>
      )}
      <div className="pbg-loc-actions">
        <OpenLink href={result.url}>{result.status === "ok" ? "Vérifier sur Google Maps" : "Ouvrir le lien"}</OpenLink>
        {applied ? (
          <span className="pbg-loc-confirmed"><Check size={13} strokeWidth={2.4} /> Lien utilisé</span>
        ) : (
          <button type="button" className="pbg-loc-btn pbg-loc-btn-small" onClick={onApply}>
            <Check size={13} strokeWidth={2.2} /> Utiliser ce lien
          </button>
        )}
      </div>
    </div>
  );
}

export default function DeliveryLocationPicker({ latitude, longitude, mapsUrl, onChange }) {
  const { status: geoStatus, requestPrecisePosition } = useGeolocation();
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const [linkText, setLinkText] = useState("");

  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasLink = Boolean(mapsUrl);
  const linkResult = parseGoogleMapsLink(linkText);

  async function useMyPosition() {
    setGeoMessage("");
    setLocating(true);
    try {
      const position = await requestPrecisePosition();
      if (position.accuracy > MAX_ACCURACY_M) {
        setGeoMessage(`Position trop imprécise (± ${formatDistance(position.accuracy)}) : elle n'a pas été enregistrée. Sur ordinateur, la position est estimée via la connexion internet et peut être fausse de plusieurs kilomètres. Utilisez votre téléphone avec le GPS activé, ou collez un lien Google Maps.`);
        return;
      }
      if (!isInDeliveryArea(position.latitude, position.longitude)) {
        setGeoMessage("Votre position actuelle est en dehors de notre zone de livraison à Alger. Si vous commandez pour une autre adresse, collez plutôt un lien Google Maps.");
        return;
      }
      setAccuracy(position.accuracy);
      onChange({ deliveryLatitude: position.latitude, deliveryLongitude: position.longitude });
    } catch (err) {
      setGeoMessage(GEO_ERRORS[err?.status] || GEO_ERRORS.error);
    } finally {
      setLocating(false);
    }
  }

  function removeLink() {
    setLinkText("");
    onChange({ deliveryMapsUrl: "" });
  }

  function removePosition() {
    setAccuracy(null);
    onChange({ deliveryLatitude: null, deliveryLongitude: null });
  }

  return (
    <div className="pbg-loc-picker">
      <div className="pbg-loc-head">
        <p className="pbg-loc-title"><MapPin size={14} strokeWidth={2} /> Point exact <small>optionnel</small></p>
        <p className="pbg-loc-hint">Aidez le livreur à trouver votre entrée : collez un lien Google Maps ou partagez votre position.</p>
      </div>

      <div className="pbg-loc-options">
        <div className="pbg-loc-option">
          <label className="pbg-loc-link">
            <span><Link2 size={12} strokeWidth={2} /> Coller un lien Google Maps</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
              placeholder="https://maps.app.goo.gl/…"
            />
          </label>
          <LinkFeedback
            result={linkResult}
            applied={Boolean(linkResult.url) && linkResult.url === mapsUrl}
            onApply={() => onChange({ deliveryMapsUrl: linkResult.url })}
          />
        </div>

        <div className="pbg-loc-option">
          <p className="pbg-loc-option-title"><Crosshair size={12} strokeWidth={2} /> Ma position</p>
          <button type="button" className="pbg-loc-btn" onClick={useMyPosition} disabled={locating}>
            <Crosshair size={15} strokeWidth={2} />
            <span>{locating ? "Recherche du signal GPS…" : "Utiliser ma position exacte"}</span>
          </button>
          <p className="pbg-loc-note">
            {geoStatus === "denied"
              ? "Localisation refusée sur cet appareil."
              : locating
                ? "Quelques secondes : le GPS affine votre position."
                : "Depuis votre téléphone, GPS activé, si vous êtes déjà à l'adresse de livraison."}
          </p>
          {geoMessage && <p className="pbg-loc-feedback is-error" role="status">{geoMessage}</p>}
        </div>
      </div>

      {hasLink || hasPosition ? (
        <div className="pbg-loc-selected">
          <p className="pbg-loc-selected-title">Ce que recevra le livreur</p>
          {hasLink && (
            <div className="pbg-loc-selected-row">
              <p><Check size={14} strokeWidth={2.4} /> <b>Votre lien Google Maps</b>{hasPosition ? " (ouvert en priorité)" : ""}</p>
              <div className="pbg-loc-actions">
                <OpenLink href={mapsUrl}>Ouvrir</OpenLink>
                <button type="button" className="pbg-loc-btn pbg-loc-btn-small pbg-loc-btn-ghost" onClick={removeLink}>
                  <X size={13} strokeWidth={2} /> Retirer
                </button>
              </div>
            </div>
          )}
          {hasPosition && (
            <div className="pbg-loc-selected-row">
              <p>
                <Check size={14} strokeWidth={2.4} /> <b>Votre position exacte</b>
                {hasLink ? " (en secours)" : ""} : {formatPoint(latitude, longitude)}
                {accuracy ? <span className="pbg-loc-accuracy"> · précision ± {accuracy} m</span> : null}
              </p>
              {accuracy > LOW_ACCURACY_M && (
                <p className="pbg-loc-feedback is-warn">Position approximative : vérifiez-la, ou collez un lien Google Maps plus précis.</p>
              )}
              <div className="pbg-loc-actions">
                <OpenLink href={coordinatesMapsUrl(latitude, longitude)}>Vérifier sur Google Maps</OpenLink>
                <button type="button" className="pbg-loc-btn pbg-loc-btn-small pbg-loc-btn-ghost" onClick={removePosition}>
                  <X size={13} strokeWidth={2} /> Retirer
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="pbg-loc-empty">Aucun point enregistré : le livreur utilisera l'adresse et la commune ci-dessus.</p>
      )}
    </div>
  );
}
