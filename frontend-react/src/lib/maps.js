// Helpers Google Maps partages entre backoffice et PWA livreur.
// Aucune cle API : liens publics maps.google.com.

// Lien de navigation direct vers le point exact d une commande si dispo,
// sinon recherche textuelle a partir de l adresse+commune (fallback pour
// les anciennes commandes sans coordonnees).
export function orderMapsHref(order) {
  if (Number.isFinite(order?.deliveryLatitude) && Number.isFinite(order?.deliveryLongitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`;
  }
  const query = encodeURIComponent(`${order?.deliveryAddress || ""}, ${order?.communeName || ""}, Alger, Algérie`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// True si la commande porte un point precis choisi par le client au checkout.
export function hasPreciseLocation(order) {
  return Number.isFinite(order?.deliveryLatitude) && Number.isFinite(order?.deliveryLongitude);
}
