// Rate limiting en-memoire, sans dependance externe. Volontairement minimal :
// - Fenêtre glissante par cle (typiquement IP + route)
// - Retourne 429 + Retry-After
// - Nettoyage passif a chaque acces (pas de setInterval qui empeche l'arret)
//
// Etape suivante prevue : swap l'implementation par Redis (meme interface).

import { resolveClientIp } from "./security.js";

export class InMemoryRateLimiter {
  constructor({ windowMs, max, name = "default" } = {}) {
    if (!windowMs || !max) throw new Error("InMemoryRateLimiter requires windowMs and max.");
    this.windowMs = Number(windowMs);
    this.max = Number(max);
    this.name = name;
    this.buckets = new Map();
  }

  // Renvoie { allowed, retryAfterSeconds, remaining }.
  hit(key, now = Date.now()) {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this._sweep(now);
      return { allowed: true, retryAfterSeconds: 0, remaining: this.max - 1 };
    }
    bucket.count += 1;
    if (bucket.count > this.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return { allowed: false, retryAfterSeconds, remaining: 0 };
    }
    return { allowed: true, retryAfterSeconds: 0, remaining: this.max - bucket.count };
  }

  reset(key) {
    this.buckets.delete(key);
  }

  // Nettoyage passif : evite de laisser exploser la Map si le serveur tourne
  // longtemps. On limite l'inspection a 128 entrees pour ne pas bloquer.
  _sweep(now) {
    if (this.buckets.size < 512) return;
    let inspected = 0;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
      if (++inspected > 128) break;
    }
  }
}

// Applique le limiter sur une requete HTTP. `keyExtras` distingue les buckets
// par route (login, signup, orders, …) pour eviter qu'un flood sur /orders
// bloque /login du meme IP par accident.
export function applyRateLimit(limiter, request, response, keyExtras = "") {
  const ip = resolveClientIp(request);
  const key = `${limiter.name}:${keyExtras}:${ip}`;
  const outcome = limiter.hit(key);
  if (!outcome.allowed) {
    response.setHeader("Retry-After", String(outcome.retryAfterSeconds));
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.statusCode = 429;
    response.end(JSON.stringify({
      error: {
        code: "RATE_LIMITED",
        message: "Trop de requêtes. Réessayez plus tard.",
        retryAfterSeconds: outcome.retryAfterSeconds,
      },
    }));
    return false;
  }
  return true;
}

// Fabrique par convention : lit une paire d'env vars WINDOW/MAX avec des
// valeurs par defaut raisonnables. Ces limites peuvent etre overridees en prod
// sans changement de code.
export function limiterFromEnv(name, defaults) {
  const windowMs = Number.parseInt(process.env[`RL_${name.toUpperCase()}_WINDOW_MS`] || "", 10) || defaults.windowMs;
  const max = Number.parseInt(process.env[`RL_${name.toUpperCase()}_MAX`] || "", 10) || defaults.max;
  return new InMemoryRateLimiter({ windowMs, max, name });
}
