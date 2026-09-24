import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "galatee.cart";

const CartContext = createContext({
  cart: {},
  count: 0,
  add: () => {},
  remove: () => {},
  set: () => {},
  clear: () => {},
  replace: () => {},
});

function readStore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function writeStore(cart) {
  try { sessionStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* ignore */ }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readStore);

  useEffect(() => { writeStore(cart); }, [cart]);

  const add = useCallback((id, qty = 1) => {
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + qty) }));
  }, []);
  const set = useCallback((id, qty) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }, []);
  const remove = useCallback((id) => {
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  }, []);
  const clear = useCallback(() => setCart({}), []);
  const replace = useCallback((next) => setCart(next || {}), []);

  const count = useMemo(
    () => Object.values(cart).reduce((sum, q) => sum + (Number(q) || 0), 0),
    [cart]
  );

  const value = useMemo(
    () => ({ cart, count, add, set, remove, clear, replace }),
    [cart, count, add, set, remove, clear, replace]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
