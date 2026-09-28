export const API_BASE = String(import.meta.env.VITE_API_BASE || window.GALATEE_API_BASE || "/api").replace(/\/+$/, "");

export async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Une erreur est survenue.");
    error.code = payload?.error?.code;
    error.status = response.status;
    error.details = payload?.error;
    throw error;
  }
  return payload;
}

export function requestCustomerCode(body) {
  return apiJson("/auth/request-code", { method: "POST", body: JSON.stringify(body) });
}

export function createCustomerAccount(body) {
  return apiJson("/auth/signup", { method: "POST", body: JSON.stringify(body) });
}

export function loginCustomer(body) {
  return apiJson("/auth/login", { method: "POST", body: JSON.stringify(body) });
}

export function verifyCustomerCode(body) {
  return apiJson("/auth/verify-code", { method: "POST", body: JSON.stringify(body) });
}
export function requestCustomerPasswordReset(body) {
  return apiJson("/auth/request-password-reset", { method: "POST", body: JSON.stringify(body) });
}
export function confirmCustomerPasswordReset(body) {
  return apiJson("/auth/confirm-password-reset", { method: "POST", body: JSON.stringify(body) });
}

export function fetchCurrentCustomer() {
  return apiJson("/auth/me");
}

export function logoutCustomer() {
  return apiJson("/auth/logout", { method: "POST" });
}

export function fetchCustomerOrders() {
  return apiJson("/account/orders");
}

export async function fetchDeliveryCommunes() {
  const payload = await apiJson("/delivery-communes");
  return Array.isArray(payload?.communes) ? payload.communes : [];
}

export function fetchPastaLoverClub() {
  return apiJson("/pasta-lover-club");
}

export function createOrder(body) {
  return apiJson("/orders", { method: "POST", body: JSON.stringify(body) });
}

const SESSION_KEY = "galatee.sessionId";
function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = createSessionId(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch {
    return createSessionId();
  }
}
export function trackEvent(eventName) {
  try {
    fetch(`${API_BASE}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, sessionId: getSessionId(), pagePath: window.location.pathname }),
    }).catch(() => {});
  } catch {
    // Analytics must never prevent a public route from rendering.
  }
}

export const categories = [
  { value: "all", label: "Tout" },
  { value: "fresca", label: "Pasta fresca" },
  { value: "ripiena", label: "Pasta ripiena" },
  { value: "dolci", label: "Dolci" },
];

// ─── Carte canonique Pasta by Galatée ────────────────────────────────────
// C'est la source de vérité de la carte publique. Les 3 plats servis dans les
// box Pasta by Galatée. Utilisée comme fallback si l'API est indisponible
// et pour remapper les anciens slugs backend legacy.
const PBG_CANONICAL_MENU = [
  {
    id: "spaghetti-pomodoro",
    category: "fresca",
    title: "Spaghetti Pomodoro",
    shortDescription: "Tomates San Marzano, basilic frais, parmesan",
    longDescription: "Sauce tomate mijotée aux San Marzano, spaghetti al dente, feuilles de basilic frais et copeaux de Parmigiano. Le classique italien, généreux et parfait.",
    imageUrl: "/assets/pasta-by-galatee/menu-spaghetti-pomodoro-v1.png",
    imageAlt: "Spaghetti Pomodoro servi dans une box Pasta by Galatée",
    priceCents: 2900,
    available: true,
  },
  {
    id: "spaghetti-carbonara",
    category: "fresca",
    title: "Spaghetti Carbonara",
    shortDescription: "Guanciale, œuf, pecorino romano, poivre noir",
    longDescription: "La vraie carbonara romaine : œuf soyeux, guanciale croustillant, pecorino romano bien affiné et poivre noir concassé. Ni crème, ni ail — juste l'essentiel.",
    imageUrl: "/assets/pasta-by-galatee/menu-spaghetti-carbonara-v1.png",
    imageAlt: "Spaghetti Carbonara servi dans une box Pasta by Galatée",
    priceCents: 2700,
    available: true,
  },
  {
    id: "tiramisu-me-up",
    category: "dolci",
    title: "Tiramisu me up",
    shortDescription: "Mascarpone, café espresso, cacao, chocolat noir",
    longDescription: "Notre tiramisu maison : mascarpone soyeux, biscuits imbibés d'espresso frais, cacao amer et éclats de chocolat noir. À emporter ou à savourer sur place.",
    imageUrl: "/assets/pasta-by-galatee/menu-tiramisu-v1.png",
    imageAlt: "Tiramisu servi dans une box rectangulaire Pasta by Galatée",
    priceCents: 2600,
    available: true,
  },
];

// Table de conversion des anciens slugs backend legacy vers les 3 plats
// canoniques. Si le backend renvoie encore ses vieux IDs (seed d'origine),
// on les remappe complètement — titre, image, prix, description.
const LEGACY_TO_CANONICAL = {
  "tagliolini-beurre-noisette": "spaghetti-pomodoro",
  "ravioli-courge-sauge": "spaghetti-carbonara",
  "tortelli-betterave-ricotta": "tiramisu-me-up",
};

const CANONICAL_BY_ID = new Map(PBG_CANONICAL_MENU.map((d) => [d.id, d]));

function withPbgOverride(item) {
  // Si l'item porte un slug legacy, on le remplace intégralement.
  const canonicalId = LEGACY_TO_CANONICAL[item.id];
  if (canonicalId) {
    const canonical = CANONICAL_BY_ID.get(canonicalId);
    if (canonical) return { ...canonical, id: canonicalId };
  }
  // Si le backend a été mis à jour et renvoie déjà l'ID canonique, on garde
  // ses données mais on force l'image et l'alt canoniques pour cohérence.
  const canonical = CANONICAL_BY_ID.get(item.id);
  if (canonical) {
    return {
      ...item,
      imageUrl: item.imageUrl || canonical.imageUrl,
      imageAlt: item.imageAlt || canonical.imageAlt,
    };
  }
  return item;
}

// Utilisé quand l'API est down — on sert directement la carte canonique.
const FALLBACK_MENU = PBG_CANONICAL_MENU;

export function categoryLabel(value) {
  return categories.find((item) => item.value === value)?.label || value;
}
function makeWebpSrcSet(imageUrl) {
  if (!imageUrl) return "";
  const match = imageUrl.match(/^(.*)\.(png|jpg|jpeg|webp)$/i);
  if (!match) return "";
  const base = match[1];
  return `${base}-640.webp 640w, ${base}-960.webp 960w`;
}
export function toDish(item) {
  return {
    id: item.id,
    slug: item.id,
    productType: item.productType || item.itemType || "dish",
    category: item.category,
    label: categoryLabel(item.category),
    title: item.title,
    summary: item.shortDescription,
    image: item.imageUrl,
    webpSrcSet: makeWebpSrcSet(item.imageUrl),
    alt: item.imageAlt || item.title,
    description: item.longDescription,
    priceCents: item.priceCents || 0,
    price: item.price || "0.00",
    available: item.available !== false,
  };
}

export async function fetchMenu() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}/menu`, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error("menu-fetch-failed");
    const payload = await response.json();
    return Array.isArray(payload.menu) ? payload.menu.map(withPbgOverride).map(toDish) : [];
  } catch {
    return FALLBACK_MENU.map(withPbgOverride).map(toDish);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
