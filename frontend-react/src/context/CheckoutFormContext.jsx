import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "galatee.checkoutForm";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  deliveryMode: "delivery",
  communeId: "",
  deliveryAddress: "",
  note: "",
  loyaltyRewardId: "",
};

const CheckoutFormContext = createContext({
  form: EMPTY_FORM,
  update: () => {},
  merge: () => {},
  reset: () => {},
});

function readStore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_FORM };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return { ...EMPTY_FORM, ...parsed };
    return { ...EMPTY_FORM };
  } catch { return { ...EMPTY_FORM }; }
}

function writeStore(form) {
  try { sessionStorage.setItem(KEY, JSON.stringify(form)); } catch { /* ignore */ }
}

export function CheckoutFormProvider({ children }) {
  const [form, setForm] = useState(readStore);

  useEffect(() => { writeStore(form); }, [form]);

  const update = useCallback((name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  }, []);

  const merge = useCallback((patch) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setForm({ ...EMPTY_FORM }), []);

  const value = useMemo(() => ({ form, update, merge, reset }), [form, update, merge, reset]);

  return <CheckoutFormContext.Provider value={value}>{children}</CheckoutFormContext.Provider>;
}

export function useCheckoutForm() {
  return useContext(CheckoutFormContext);
}

export { EMPTY_FORM };
