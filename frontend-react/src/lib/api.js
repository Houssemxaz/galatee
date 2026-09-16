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

export function fetchCurrentCustomer() {
  return apiJson("/auth/me");
}

export function logoutCustomer() {
  return apiJson("/auth/logout", { method: "POST" });
}

export function fetchCustomerReservations() {
  return apiJson("/account/reservations");
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

// Override frontend : la carte affichée montre les box Pasta by Galatée.
// Le backend garde ses slugs originaux — on remplace ici titre / description /
// image / catégorie pour aligner avec le nouveau packaging sans toucher au seed.
const PBG_MENU_OVERRIDE = {
  "tagliolini-beurre-noisette": {
    category: "fresca",
    title: "Spaghetti Pomodoro",
    shortDescription: "Tomates San Marzano, basilic frais, parmesan",
    longDescription: "Sauce tomate mijotée aux San Marzano, spaghetti al dente, feuilles de basilic frais et copeaux de Parmigiano. Le classique italien, généreux et parfait.",
    imageUrl: "/assets/pasta-by-galatee/menu-spaghetti-pomodoro-v1.png",
    imageAlt: "Spaghetti Pomodoro servi dans une box Pasta by Galatée",
    priceCents: 2900,
  },
  "ravioli-courge-sauge": {
    category: "fresca",
    title: "Spaghetti Carbonara",
    shortDescription: "Guanciale, œuf, pecorino romano, poivre noir",
    longDescription: "La vraie carbonara romaine : œuf soyeux, guanciale croustillant, pecorino romano bien affiné et poivre noir concassé. Ni crème, ni ail — juste l'essentiel.",
    imageUrl: "/assets/pasta-by-galatee/menu-spaghetti-carbonara-v1.png",
    imageAlt: "Spaghetti Carbonara servi dans une box Pasta by Galatée",
    priceCents: 2700,
  },
  "tortelli-betterave-ricotta": {
    category: "dolci",
    title: "Tiramisu me up",
    shortDescription: "Mascarpone, café espresso, cacao, chocolat noir",
    longDescription: "Notre tiramisu maison : mascarpone soyeux, biscuits imbibés d'espresso frais, cacao amer et éclats de chocolat noir. À emporter ou à savourer sur place.",
    imageUrl: "/assets/pasta-by-galatee/menu-tiramisu-v1.png",
    imageAlt: "Tiramisu servi dans une box rectangulaire Pasta by Galatée",
    priceCents: 2600,
  },
};

function withPbgOverride(item) {
  const override = PBG_MENU_OVERRIDE[item.id];
  return override ? { ...item, ...override } : item;
}

// Keeps the public menu usable during a tunnel/network interruption. The API
// remains the source of truth whenever it responds successfully.
const FALLBACK_MENU = [
  {
    id: "tagliolini-beurre-noisette",
    category: "fresca",
    title: "Tagliolini, beurre noisette",
    shortDescription: "Truffe noire, parmesan 36 mois",
    longDescription: "Une pâte fine tirée chaque jour, nappée d'un beurre noisette aux notes de sous-bois. La truffe noire et le parmesan affiné apportent une profondeur nette, sans alourdir l'assiette.",
    imageUrl: "/assets/menu-tagliolini.png",
    imageAlt: "Tagliolini frais avec truffe noire et parmesan",
    priceCents: 2900,
  },
  {
    id: "ravioli-courge-sauge",
    category: "vegetal",
    title: "Ravioli de courge, sauge",
    shortDescription: "Noisette du Piémont, vinaigre de Xérès",
    longDescription: "La courge rôtie est enveloppée dans une pâte souple, puis servie avec une sauge croustillante, la rondeur de la noisette et quelques gouttes de vinaigre de Xérès.",
    imageUrl: "/assets/menu-ravioli.png",
    imageAlt: "Ravioli de courge avec beurre de sauge et noisettes",
    priceCents: 2700,
  },
  {
    id: "tortelli-betterave-ricotta",
    category: "ripiena",
    title: "Tortelli betterave & ricotta",
    shortDescription: "Huile d'herbes, citron confit",
    longDescription: "Une farce de betterave rôtie et ricotta fraîche, relevée par le citron confit. L'huile d'herbes termine le plat avec une fraîcheur végétale et précise.",
    imageUrl: "/assets/menu-tortelli.png",
    imageAlt: "Tortelli de betterave et ricotta avec herbes fraîches",
    priceCents: 2600,
  },
];

export function categoryLabel(value) {
  return categories.find((item) => item.value === value)?.label || value;
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
