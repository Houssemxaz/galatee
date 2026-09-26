import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./DeliveryLocationPicker.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Crosshair, MapPin, X } from "lucide-react";

// Fix des icones Leaflet apres bundling : par defaut Leaflet cherche des URLs
// relatives qui n existent pas apres build. On force les assets importes.
const DEFAULT_ICON = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Centre par defaut : Hydra, coeur de la zone de livraison.
const DEFAULT_CENTER = [36.751, 3.045];
const DEFAULT_ZOOM = 14;
const PIN_ZOOM = 16;

function ClickToPlace({ onPlace }) {
  useMapEvents({
    click(event) {
      onPlace(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function RecenterOnPin({ position, zoom }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!position) return;
    const key = `${position[0]}|${position[1]}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    map.flyTo(position, zoom, { duration: 0.6 });
  }, [position, zoom, map]);
  return null;
}

export default function DeliveryLocationPicker({ latitude, longitude, onChange }) {
  const [askingGeo, setAskingGeo] = useState(false);
  const [geoError, setGeoError] = useState("");

  const position = useMemo(
    () => (Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null),
    [latitude, longitude],
  );

  function place(lat, lng) {
    onChange({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
  }

  function clear() {
    onChange({ latitude: null, longitude: null });
  }

  function useMyPosition() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocalisation non disponible sur ce navigateur.");
      return;
    }
    setGeoError("");
    setAskingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAskingGeo(false);
        place(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setAskingGeo(false);
        setGeoError(err.code === err.PERMISSION_DENIED
          ? "Autorisez la localisation pour utiliser votre position."
          : "Position indisponible. Placez le point à la main.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  return (
    <div className="pbg-map-picker">
      <div className="pbg-map-picker-head">
        <div className="pbg-map-picker-copy">
          <p className="pbg-map-picker-title"><MapPin size={14} strokeWidth={2} /> Point exact <small>optionnel</small></p>
          <p className="pbg-map-picker-hint">Déplacez le marker ou cliquez sur la carte pour aider le livreur à trouver l'entrée.</p>
        </div>
        <div className="pbg-map-picker-actions">
          <button type="button" className="pbg-map-picker-btn" onClick={useMyPosition} disabled={askingGeo}>
            <Crosshair size={13} strokeWidth={2} />
            <span>{askingGeo ? "Localisation…" : "Ma position"}</span>
          </button>
          {position && (
            <button type="button" className="pbg-map-picker-btn pbg-map-picker-btn-ghost" onClick={clear}>
              <X size={13} strokeWidth={2} />
              <span>Retirer</span>
            </button>
          )}
        </div>
      </div>

      <div className="pbg-map-picker-canvas">
        <MapContainer
          center={position || DEFAULT_CENTER}
          zoom={position ? PIN_ZOOM : DEFAULT_ZOOM}
          scrollWheelZoom={false}
          style={{ height: "260px", width: "100%", borderRadius: "12px" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPlace={place} />
          {position && (
            <>
              <RecenterOnPin position={position} zoom={PIN_ZOOM} />
              <Marker
                position={position}
                icon={DEFAULT_ICON}
                draggable
                eventHandlers={{
                  dragend(event) {
                    const { lat, lng } = event.target.getLatLng();
                    place(lat, lng);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {position ? (
        <p className="pbg-map-picker-coords">
          Point sélectionné : <b>{position[0].toFixed(5)}°N, {position[1].toFixed(5)}°E</b>
        </p>
      ) : (
        <p className="pbg-map-picker-coords pbg-map-picker-coords-muted">Aucun point sélectionné.</p>
      )}
      {geoError && <p className="pbg-map-picker-error" role="status">{geoError}</p>}
    </div>
  );
}
