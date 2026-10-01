import { useState } from "react";
import { Check, Crosshair, ExternalLink, Link2, MapPin, X } from "lucide-react";
import { useGeolocation } from "@/context/GeolocationContext";
import { isInDeliveryArea, parseGoogleMapsLink } from "@/lib/googleMapsLink";
import "./DeliveryLocationPicker.css";

// Point exact de livraison, sans carte : soit la position du telephone
// (permission deja demandee a l arrivee sur le site, cf. GeolocationContext),
// soit un lien Google Maps colle par le client. Les deux remplissent
// deliveryLatitude / deliveryLongitude, que lib/maps.js utilise en priorite
// sur l adresse texte pour le lien de navigation du livreur.

// Au-dela, on previent le client que sa position est approximative.
const LOW_ACCURACY_M = 150;

const SOURCE_LABELS = {
  position: "votre position",
  link: "lien Google Maps",
};

const GEO_ERRORS = {
  denied: "Localisation refusée. Autorisez-la dans les réglages du navigateur, ou collez un lien Google Maps.",
  unavailable: "La localisation n'est pas disponible sur ce navigateur. Collez plutôt un lien Google Maps.",
  error: "Position introuvable pour le moment. Réessayez dans un instant, ou collez un lien Google Maps.",
};

function formatPoint(latitude, longitude) {
  return `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`;
}

function verifyHref(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function VerifyLink({ latitude, longitude }) {
  return (
    <a href={verifyHref(latitude, longitude)} target="_blank" rel="noopener noreferrer" className="pbg-loc-verify">
      Vérifier sur Google Maps <ExternalLink size={12} strokeWidth={2} />
    </a>
  );
}

function LinkFeedback({ result, confirmed, onConfirm }) {
  switch (result.status) {
    case "empty":
      return null;
    case "ok":
      return (
        <div className="pbg-loc-feedback is-ok" role="status">
          <p>Point détecté : <b>{formatPoint(result.latitude, result.longitude)}</b></p>
          <div className="pbg-loc-actions">
            <VerifyLink latitude={result.latitude} longitude={result.longitude} />
            {confirmed ? (
              <span className="pbg-loc-confirmed"><Check size={13} strokeWidth={2.4} /> Point utilisé</span>
            ) : (
              <button type="button" className="pbg-loc-btn pbg-loc-btn-small" onClick={onConfirm}>
                <Check size={13} strokeWidth={2.2} /> Utiliser ce point
              </button>
            )}
          </div>
        </div>
      );
    case "out-of-area":
      return (
        <p className="pbg-loc-feedback is-error" role="status">
          Ce point ({formatPoint(result.latitude, result.longitude)}) est en dehors de notre zone de livraison à Alger. Vérifiez le lien.
        </p>
      );
    case "short-link":
      return (
        <p className="pbg-loc-feedback is-error" role="status">
          Les liens courts <b>maps.app.goo.gl</b> ne sont pas pris en charge : ils ne contiennent pas les coordonnées.
          Dans l'app Google Maps, faites un appui long sur votre entrée et copiez les coordonnées affichées
          (ex. 36.75031, 3.04412), ou copiez le lien complet depuis la barre d'adresse d'un navigateur.
          Vous pouvez aussi utiliser votre position exacte.
        </p>
      );
    case "no-coordinates":
      return (
        <p className="pbg-loc-feedback is-error" role="status">
          Ce lien Google Maps ne contient pas de coordonnées. Placez un repère sur votre entrée puis copiez le lien
          complet (il contient « @ » suivi de chiffres), ou utilisez votre position exacte.
        </p>
      );
    default:
      return (
        <p className="pbg-loc-feedback is-error" role="status">
          Lien non reconnu. Collez un lien Google Maps complet (https://www.google.com/maps/…) ou des coordonnées,
          ou utilisez votre position exacte.
        </p>
      );
  }
}

export default function DeliveryLocationPicker({ latitude, longitude, onChange }) {
  const { status: geoStatus, requestPosition } = useGeolocation();
  const [source, setSource] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const [linkText, setLinkText] = useState("");

  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude);
  const linkResult = parseGoogleMapsLink(linkText);
  const linkApplied = linkResult.status === "ok" && source === "link"
    && linkResult.latitude === latitude && linkResult.longitude === longitude;

  function apply(point, nextSource) {
    setSource(nextSource);
    onChange({ latitude: point.latitude, longitude: point.longitude });
  }

  async function useMyPosition() {
    setGeoMessage("");
    setLocating(true);
    try {
      const position = await requestPosition();
      if (!isInDeliveryArea(position.latitude, position.longitude)) {
        setGeoMessage("Votre position actuelle est en dehors de notre zone de livraison à Alger. Si vous commandez pour une autre adresse, collez plutôt un lien Google Maps.");
        return;
      }
      setAccuracy(position.accuracy);
      apply(position, "position");
    } catch (err) {
      setGeoMessage(GEO_ERRORS[err?.status] || GEO_ERRORS.error);
    } finally {
      setLocating(false);
    }
  }

  function clear() {
    setSource(null);
    setAccuracy(null);
    setLinkText("");
    onChange({ latitude: null, longitude: null });
  }

  return (
    <div className="pbg-loc-picker">
      <div className="pbg-loc-head">
        <p className="pbg-loc-title"><MapPin size={14} strokeWidth={2} /> Point exact <small>optionnel</small></p>
        <p className="pbg-loc-hint">Aidez le livreur à trouver votre entrée : partagez votre position ou collez un lien Google Maps.</p>
      </div>

      <div className="pbg-loc-options">
        <div className="pbg-loc-option">
          <p className="pbg-loc-option-title"><Crosshair size={12} strokeWidth={2} /> Ma position</p>
          <button type="button" className="pbg-loc-btn" onClick={useMyPosition} disabled={locating}>
            <Crosshair size={15} strokeWidth={2} />
            <span>{locating ? "Localisation…" : "Utiliser ma position exacte"}</span>
          </button>
          <p className="pbg-loc-note">
            {geoStatus === "denied"
              ? "Localisation refusée sur cet appareil."
              : "Idéal si vous êtes déjà à l'adresse de livraison."}
          </p>
          {geoMessage && <p className="pbg-loc-feedback is-error" role="status">{geoMessage}</p>}
        </div>

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
              placeholder="https://www.google.com/maps/@36.75,3.04,17z"
            />
          </label>
          <LinkFeedback result={linkResult} confirmed={linkApplied} onConfirm={() => apply(linkResult, "link")} />
        </div>
      </div>

      {hasPoint ? (
        <div className="pbg-loc-selected">
          <p>
            <Check size={14} strokeWidth={2.4} /> Point enregistré{source ? ` (${SOURCE_LABELS[source]})` : ""} :{" "}
            <b>{formatPoint(latitude, longitude)}</b>
            {source === "position" && accuracy ? <span className="pbg-loc-accuracy"> · précision ± {accuracy} m</span> : null}
          </p>
          {source === "position" && accuracy > LOW_ACCURACY_M && (
            <p className="pbg-loc-feedback is-warn">Position approximative : vérifiez-la, ou collez un lien Google Maps plus précis.</p>
          )}
          <div className="pbg-loc-actions">
            <VerifyLink latitude={latitude} longitude={longitude} />
            <button type="button" className="pbg-loc-btn pbg-loc-btn-small pbg-loc-btn-ghost" onClick={clear}>
              <X size={13} strokeWidth={2} /> Retirer
            </button>
          </div>
        </div>
      ) : (
        <p className="pbg-loc-empty">Aucun point enregistré : l'adresse ci-dessus suffit, le livreur vous appellera si besoin.</p>
      )}
    </div>
  );
}
