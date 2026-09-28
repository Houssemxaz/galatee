// Idempotency-Key en memoire pour POST /api/orders. Deux commandes portant la
// meme cle depuis la meme identite (customerId ou IP+cookie) partagent la meme
// reponse et ne creent pas deux commandes en base.
//
// Volontairement in-memory pour cette premiere baseline. Un swap Redis se
// contentera de remplacer InMemoryIdempotencyStore par une classe qui expose
// begin() / complete() / get() de facon distribuee.

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

const KEY_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export class InMemoryIdempotencyStore {
  constructor({ ttlMs = DEFAULT_TTL_MS } = {}) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  // Renvoie l'entree existante (status + response) ou null.
  get(scope, key, now = Date.now()) {
    const full = `${scope}:${key}`;
    const entry = this.entries.get(full);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.entries.delete(full);
      return null;
    }
    return entry;
  }

  // Prend un verrou "in-flight" pour eviter deux traitements simultanes de la
  // meme cle. Retourne true si le verrou a ete acquis, false sinon (une autre
  // requete est deja en cours ou une reponse a deja ete enregistree).
  beginOrGet(scope, key, now = Date.now()) {
    const full = `${scope}:${key}`;
    const existing = this.entries.get(full);
    if (existing) {
      if (existing.expiresAt <= now) {
        this.entries.delete(full);
      } else {
        return { acquired: false, entry: existing };
      }
    }
    const entry = { status: "in_flight", expiresAt: now + this.ttlMs };
    this.entries.set(full, entry);
    return { acquired: true, entry };
  }

  complete(scope, key, response, now = Date.now()) {
    const full = `${scope}:${key}`;
    const entry = { status: "done", response, expiresAt: now + this.ttlMs };
    this.entries.set(full, entry);
    return entry;
  }

  release(scope, key) {
    // Retire un verrou in_flight sur erreur (sinon la meme cle reste bloquee
    // le temps du TTL alors qu'aucune commande n'a ete creee).
    const full = `${scope}:${key}`;
    const entry = this.entries.get(full);
    if (entry && entry.status === "in_flight") this.entries.delete(full);
  }
}

// Valide qu'un header Idempotency-Key est utilisable. Rejette silencieusement
// les valeurs non conformes (evite qu'un client mal configure declenche des
// erreurs 400 sur toutes ses commandes).
export function readIdempotencyKey(request) {
  const raw = request.headers["idempotency-key"];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!KEY_PATTERN.test(trimmed)) return null;
  return trimmed;
}
