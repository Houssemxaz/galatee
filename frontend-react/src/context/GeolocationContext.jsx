import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Position du client demandee des l arrivee sur le site, pour qu au checkout
// la permission soit deja tranchee (accordee ou refusee) et que le bouton
// "Utiliser ma position exacte" reponde instantanement.
//
// Deux declencheurs :
//   1. Au montage : demande automatique (ou lecture silencieuse si la
//      permission est deja accordee).
//   2. Au premier clic / touche n importe ou : certains navigateurs ignorent
//      ou mettent en sourdine une demande sans geste utilisateur. Meme
//      principe que le deblocage du son dans backoffice/orders/OrdersPage.jsx.
//
// Le resultat (coordonnees ou refus) est garde en sessionStorage.

const KEY = "galatee.geolocation";
// Au-dela, le bouton du checkout redemande une position fraiche.
const FRESH_MS = 5 * 60 * 1000;
const FINAL_STATUSES = ["granted", "denied", "unavailable"];
const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 };

const GeolocationContext = createContext({
  status: "idle",
  position: null,
  requestPosition: () => Promise.reject(new Error("GeolocationProvider manquant")),
});

function readStore() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (parsed && typeof parsed.status === "string") return { status: parsed.status, position: parsed.position || null };
  } catch { /* ignore */ }
  return { status: "idle", position: null };
}

function writeStore(state) {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function hasGeolocation() {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}

export function GeolocationProvider({ children }) {
  const [state, setState] = useState(() => (hasGeolocation() ? readStore() : { status: "unavailable", position: null }));
  const statusRef = useRef(state.status);
  const pendingRef = useRef(null);
  const gestureUsedRef = useRef(false);

  const apply = useCallback((next) => {
    statusRef.current = next.status;
    setState(next);
    writeStore(next);
  }, []);

  // Par defaut une seule demande en vol : un second appel recupere la meme
  // promesse. `force` relance quand meme l API, pour le cas ou le navigateur a
  // ignore la demande automatique sans jamais repondre.
  const request = useCallback(({ force = false } = {}) => {
    if (!hasGeolocation()) {
      apply({ status: "unavailable", position: null });
      return Promise.reject(Object.assign(new Error("unavailable"), { status: "unavailable" }));
    }
    if (pendingRef.current && !force) return pendingRef.current;
    statusRef.current = "pending";
    setState((current) => ({ ...current, status: "pending" }));
    const promise = new Promise((resolve, reject) => {
      const settle = () => { if (pendingRef.current === promise) pendingRef.current = null; };
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          settle();
          const position = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: pos.timestamp || Date.now(),
          };
          apply({ status: "granted", position });
          resolve(position);
        },
        (err) => {
          settle();
          // Refus explicite : definitif pour la session. Sinon (timeout, pas de
          // signal GPS) la permission peut etre accordee : on garde la derniere
          // position connue et on pourra retenter.
          const status = err.code === err.PERMISSION_DENIED ? "denied" : "error";
          setState((current) => {
            const next = { status, position: status === "denied" ? null : current.position };
            statusRef.current = status;
            writeStore(next);
            return next;
          });
          reject(Object.assign(new Error(status), { status }));
        },
        GEO_OPTIONS,
      );
    });
    pendingRef.current = promise;
    return promise;
  }, [apply]);

  // Declencheur 1 : demande automatique au montage. Pas de garde "deja fait" :
  // sous StrictMode l effet tourne deux fois et `request` deduplique.
  useEffect(() => {
    if (!hasGeolocation()) return undefined;
    let permissionStatus = null;
    let active = true;

    function onPermissionChange() {
      if (permissionStatus.state === "denied") apply({ status: "denied", position: null });
      else if (permissionStatus.state === "granted" && statusRef.current !== "granted") request().catch(() => {});
    }

    const ask = () => request().catch(() => { /* resultat deja stocke dans l etat */ });

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (active) {
          permissionStatus = result;
          result.addEventListener?.("change", onPermissionChange);
        }
        if (result.state === "denied") apply({ status: "denied", position: null });
        else ask();
      }).catch(ask);
    } else {
      ask();
    }

    return () => {
      active = false;
      permissionStatus?.removeEventListener?.("change", onPermissionChange);
    };
  }, [apply, request]);

  // Declencheur 2 : fallback au premier geste utilisateur, tant que la
  // permission n est pas tranchee. Relance l API meme si la demande
  // automatique est encore "en vol" (elle a pu etre ignoree).
  useEffect(() => {
    if (gestureUsedRef.current || FINAL_STATUSES.includes(state.status)) return undefined;
    function onFirstGesture() {
      gestureUsedRef.current = true;
      if (!FINAL_STATUSES.includes(statusRef.current)) request({ force: true }).catch(() => {});
    }
    const options = { capture: true, once: true, passive: true };
    window.addEventListener("pointerdown", onFirstGesture, options);
    window.addEventListener("keydown", onFirstGesture, options);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture, options);
      window.removeEventListener("keydown", onFirstGesture, options);
    };
  }, [state.status, request]);

  // Pour le checkout : position recente si on l a deja, sinon nouvelle demande.
  const requestPosition = useCallback(async () => {
    const { position } = state;
    if (state.status === "granted" && position && Date.now() - position.timestamp < FRESH_MS) return position;
    return request();
  }, [state, request]);

  const value = useMemo(
    () => ({ status: state.status, position: state.position, requestPosition }),
    [state.status, state.position, requestPosition],
  );

  return <GeolocationContext.Provider value={value}>{children}</GeolocationContext.Provider>;
}

export function useGeolocation() {
  return useContext(GeolocationContext);
}
