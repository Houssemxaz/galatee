// Helpers Google Maps partages entre backoffice et PWA livreur.
// Aucune cle API : liens publics maps.google.com.
import { isAllowedMapsUrl } from "@/lib/googleMapsLink";

// D ou vient la localisation d une commande, par ordre de priorite :
//   "link"     lien Google Maps colle par le client au checkout
//   "position" position exacte (GPS) partagee par le client
//   "address"  adresse texte + commune (dernier recours, anciennes commandes)
export function orderLocationSource(order) {
  // Le backend ne stocke que des liens Google Maps ; on revalide quand meme
  // avant d en faire un href.
  if (order?.deliveryMapsUrl && isAllowedMapsUrl(order.deliveryMapsUrl)) return "link";
  if (Number.isFinite(order?.deliveryLatitude) && Number.isFinite(order?.deliveryLongitude)) return "position";
  return "address";
}

export function orderMapsHref(order) {
  switch (orderLocationSource(order)) {
    case "link":
      return order.deliveryMapsUrl;
    case "position":
      return `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`;
    default: {
      const query = encodeURIComponent(`${order?.deliveryAddress || ""}, ${order?.communeName || ""}, Alger, Algérie`);
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
  }
}

// Libelle court du lien, pour le livreur et le backoffice.
export const LOCATION_SOURCE_LABELS = {
  link: "Lien Google Maps du client",
  position: "Position exacte du client",
  address: "Adresse et commune",
};
