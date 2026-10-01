// Lien Google Maps colle par le client au checkout. Le lien est transmis tel
// quel au livreur, qui l ouvre sur son telephone : c est la priorite n°1 pour
// trouver l adresse (avant la position exacte, puis l adresse texte).
//
// Cote navigateur on ne fait aucun appel reseau : on verifie que c est bien
// un lien Google Maps et on lit les coordonnees quand elles sont visibles dans
// l URL, pour montrer au client le point detecte. Les liens courts
// (maps.app.goo.gl) ne contiennent pas les coordonnees et le navigateur ne peut
// pas suivre la redirection (CORS) : ils sont acceptes, mais le client doit les
// verifier lui-meme en les ouvrant.

// Meme zone que backend/orderSystem.js (ALGIERS_LAT_MIN...) : un point hors
// de cette boite serait refuse a l envoi de la commande.
export const DELIVERY_AREA = { latMin: 36.4, latMax: 37.0, lngMin: 2.5, lngMax: 3.6 };

const MAX_URL_LENGTH = 500;
const COORD_PAIR = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function isInDeliveryArea(latitude, longitude) {
  return latitude >= DELIVERY_AREA.latMin && latitude <= DELIVERY_AREA.latMax
    && longitude >= DELIVERY_AREA.lngMin && longitude <= DELIVERY_AREA.lngMax;
}

// Liens que le livreur peut ouvrir sans risque : Google Maps en https
// uniquement. Meme regle que isAllowedMapsUrl dans backend/orderSystem.js.
export function isAllowedMapsUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (/^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return true;
  if (/^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return url.pathname.startsWith("/maps");
  return false;
}

function isShortLink(url) {
  const host = url.hostname.toLowerCase();
  return host === "maps.app.goo.gl" || host === "goo.gl";
}

export function coordinatesMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
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

// Le client colle parfois un texte de partage complet ("Regarde ici : https://...").
function extractUrl(text) {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text);
  if (match) return match[0].replace(/^http:/i, "https:");
  // Lien colle sans le schema : "google.com/maps/@36.7,3.0,17z" ou "maps.app.goo.gl/abc".
  const bare = /(?:^|\s)((?:www\.|maps\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s<>"']*)/i.exec(text);
  return bare ? `https://${bare[1]}` : null;
}

// Ordre de priorite : le marqueur du lieu (!3d...!4d...) est plus precis que
// le centre de la vue (@lat,lng) d un lien /place/ ; les parametres explicites
// (q, query, destination, ll) designent directement le point voulu.
function readCoordinates(url) {
  let raw = url.href;
  try { raw = decodeURIComponent(raw); } catch { /* garde la forme encodee */ }

  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(raw);
  if (pin) return toPoint(pin[1], pin[2]);

  for (const key of ["q", "query", "destination", "daddr", "ll"]) {
    const point = pairToPoint(url.searchParams.get(key));
    if (point) return point;
  }

  // /maps/search/36.75,3.04 ou /maps/place/36.75,3.04 ou /maps/dir//36.75,3.04
  for (const part of url.pathname.split("/")) {
    let segment = part;
    try { segment = decodeURIComponent(part); } catch { /* segment brut */ }
    const point = pairToPoint(segment);
    if (point) return point;
  }

  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(raw);
  if (view) return toPoint(view[1], view[2]);

  return null;
}

function withArea(url, point) {
  if (!isInDeliveryArea(point.latitude, point.longitude)) return { status: "out-of-area", ...point };
  return { status: "ok", url, ...point };
}

// Accepte un lien Google Maps (complet ou court), ou des coordonnees brutes
// "lat, lng" (converties en lien Google Maps). Resultats possibles :
//   { status: "empty" }
//   { status: "ok", url, latitude, longitude }  point lisible dans le lien
//   { status: "short-link", url }               lien court, point non lisible
//   { status: "no-coordinates", url }           lien complet sans coordonnees
//   { status: "out-of-area", latitude, longitude }
//   { status: "unrecognized" }                  pas un lien Google Maps
// Seuls "ok", "short-link" et "no-coordinates" portent un `url` transmissible.
export function parseGoogleMapsLink(input) {
  const text = String(input || "").trim();
  if (!text) return { status: "empty" };

  // Coordonnees brutes "36.7503, 3.0441" : c est ce qu affiche l app Google
  // Maps apres un appui long sur un point.
  const rawPoint = pairToPoint(text);
  if (rawPoint) return withArea(coordinatesMapsUrl(rawPoint.latitude, rawPoint.longitude), rawPoint);

  const href = extractUrl(text);
  if (!href || href.length > MAX_URL_LENGTH || !isAllowedMapsUrl(href)) return { status: "unrecognized" };

  const url = new URL(href);
  if (isShortLink(url)) return { status: "short-link", url: href };

  const point = readCoordinates(url);
  if (!point) return { status: "no-coordinates", url: href };
  return withArea(href, point);
}
