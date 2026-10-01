// Extraction des coordonnees depuis un lien Google Maps colle par le client.
// 100 % cote navigateur, sans appel reseau : on ne lit que ce qui est visible
// dans l URL elle-meme.
//
// Limite assumee : les liens courts (maps.app.goo.gl, goo.gl/maps) ne
// contiennent pas les coordonnees. Il faudrait suivre la redirection, ce que
// le navigateur du client ne peut pas faire (CORS). On les detecte pour
// afficher un message clair au lieu d un echec silencieux.

// Meme zone que backend/orderSystem.js (ALGIERS_LAT_MIN...) : un point hors
// de cette boite serait refuse a l envoi de la commande.
export const DELIVERY_AREA = { latMin: 36.4, latMax: 37.0, lngMin: 2.5, lngMax: 3.6 };

const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "g.co"];
const COORD_PAIR = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function isInDeliveryArea(latitude, longitude) {
  return latitude >= DELIVERY_AREA.latMin && latitude <= DELIVERY_AREA.latMax
    && longitude >= DELIVERY_AREA.lngMin && longitude <= DELIVERY_AREA.lngMax;
}

function toPoint(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
}

function pairToPoint(value) {
  // Google encode l espace en "+" meme dans le chemin : "/search/36.75,+3.04".
  const match = COORD_PAIR.exec(String(value || "").replace(/\+/g, " "));
  return match ? toPoint(match[1], match[2]) : null;
}

function isGoogleMapsUrl(url) {
  const host = url.hostname.toLowerCase();
  // google.com, google.dz, google.fr... et maps.google.<tld>
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  if (/^(www\.)?google\.[a-z.]+$/.test(host)) return url.pathname.startsWith("/maps");
  return false;
}

function isShortLink(url) {
  const host = url.hostname.toLowerCase();
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  return SHORT_LINK_HOSTS.includes(host);
}

// Le client colle parfois un texte de partage complet ("Regarde ici : https://...").
function extractUrl(text) {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text);
  if (match) return match[0];
  // Lien colle sans le schema : "google.com/maps/@36.7,3.0,17z" ou "maps.app.goo.gl/abc".
  const bare = /(?:^|\s)((?:www\.|maps\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s<>"']*)/i.exec(text);
  return bare ? `https://${bare[1]}` : null;
}

// Ordre de priorite : le marqueur du lieu (!3d...!4d...) est plus precis que
// le centre de la vue (@lat,lng) d un lien /place/ ; les parametres explicites
// (q, query, destination, ll) designent directement le point voulu.
function readCoordinates(url) {
  const raw = decodeURIComponent(url.href);

  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(raw);
  if (pin) return toPoint(pin[1], pin[2]);

  for (const key of ["q", "query", "destination", "daddr", "ll"]) {
    const point = pairToPoint(url.searchParams.get(key));
    if (point) return point;
  }

  // /maps/search/36.75,3.04 ou /maps/place/36.75,3.04 ou /maps/dir//36.75,3.04
  const segments = url.pathname.split("/").map((part) => decodeURIComponent(part));
  for (const segment of segments) {
    const point = pairToPoint(segment);
    if (point) return point;
  }

  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(raw);
  if (view) return toPoint(view[1], view[2]);

  return null;
}

// Accepte un lien Google Maps complet, ou des coordonnees brutes "lat, lng".
// Resultats possibles :
//   { status: "empty" }
//   { status: "ok", latitude, longitude }
//   { status: "out-of-area", latitude, longitude }
//   { status: "short-link" }      lien court, coordonnees non lisibles
//   { status: "no-coordinates" }  lien Google Maps sans coordonnees visibles
//   { status: "unrecognized" }    pas un lien Google Maps
export function parseGoogleMapsLink(input) {
  const text = String(input || "").trim();
  if (!text) return { status: "empty" };

  // Coordonnees brutes "36.7503, 3.0441" : c est ce qu affiche l app Google
  // Maps apres un appui long sur un point, seul moyen simple sur mobile ou le
  // bouton Partager ne donne qu un lien court.
  const rawPoint = pairToPoint(text);
  if (rawPoint) return withArea(rawPoint);

  const href = extractUrl(text);
  if (!href) return { status: "unrecognized" };

  let url;
  try { url = new URL(href); } catch { return { status: "unrecognized" }; }

  if (isShortLink(url)) return { status: "short-link" };
  if (!isGoogleMapsUrl(url)) return { status: "unrecognized" };

  const point = readCoordinates(url);
  if (!point) return { status: "no-coordinates" };
  return withArea(point);
}

function withArea(point) {
  if (!isInDeliveryArea(point.latitude, point.longitude)) return { status: "out-of-area", ...point };
  return { status: "ok", ...point };
}
