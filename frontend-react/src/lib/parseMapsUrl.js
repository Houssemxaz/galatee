// Parse une URL Google Maps pour extraire les coordonnees latitude/longitude.
// Retourne { latitude, longitude } ou null si l URL n est pas reconnue.
//
// Formats supportes :
//   - https://www.google.com/maps/@36.7515,3.0463,17z
//   - https://www.google.com/maps/place/.../@36.7515,3.0463,17z
//   - https://www.google.com/maps/place/.../data=!3d36.7515!4d3.0463!...
//   - https://maps.google.com/?q=36.7515,3.0463
//   - https://maps.google.com/?ll=36.7515,3.0463
//   - https://www.google.com/maps/dir/?api=1&destination=36.7515,3.0463
//   - https://www.google.com/maps?q=36.7515%2C3.0463
//
// Les liens raccourcis (maps.app.goo.gl/XXX, goo.gl/maps/XXX) ne peuvent pas
// etre resolus cote client a cause de CORS -> retourne null et l appelant
// devra afficher un message d aide.
//
// Bounding box optionnelle : { minLat, maxLat, minLng, maxLng } pour rejeter
// les coordonnees hors zone (par defaut : grand Alger, aligne avec le backend).

const DEFAULT_BOUNDS = {
  minLat: 36.4,
  maxLat: 37.0,
  minLng: 2.5,
  maxLng: 3.6,
};

const PATTERNS = [
  // @lat,lng[,zoom] dans le chemin
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  // !3d{lat}!4d{lng} dans les URL /place/
  /!3d(-?\d+\.\d+)[^0-9]+!4d(-?\d+\.\d+)/,
  // q=lat,lng ou ll=lat,lng ou destination=lat,lng
  /[?&](?:q|ll|destination|center)=(-?\d+\.\d+),(-?\d+\.\d+)/,
  // Encodage URL : %2C au lieu de ,
  /[?&](?:q|ll|destination|center)=(-?\d+\.\d+)%2C(-?\d+\.\d+)/i,
];

function isShortLink(url) {
  return /^(?:https?:\/\/)?(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url);
}

export function parseMapsUrl(url, { bounds = DEFAULT_BOUNDS } = {}) {
  if (typeof url !== "string" || !url.trim()) return { ok: false, reason: "empty" };
  const clean = url.trim();

  if (isShortLink(clean)) {
    return { ok: false, reason: "short_link" };
  }

  let match = null;
  for (const pattern of PATTERNS) {
    match = clean.match(pattern);
    if (match) break;
  }
  if (!match) return { ok: false, reason: "no_coords" };

  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "invalid" };
  }
  if (bounds) {
    if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng) {
      return { ok: false, reason: "out_of_range" };
    }
  }
  return { ok: true, latitude: lat, longitude: lng };
}
