import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "galatee.tableMode";
const BANNER_DISMISS_KEY = "galatee.tableMode.bannerDismissed";

const TableModeContext = createContext({
  active: false,
  bannerDismissed: false,
  dismissBanner: () => {},
  activate: () => {},
});

function readSession(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function writeSession(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* ignore */ }
}

export function TableModeProvider({ children }) {
  const [active, setActive] = useState(() => readSession(STORAGE_KEY) === "1");
  const [bannerDismissed, setBannerDismissed] = useState(() => readSession(BANNER_DISMISS_KEY) === "1");

  const activate = useCallback(() => {
    writeSession(STORAGE_KEY, "1");
    setActive(true);
  }, []);

  const dismissBanner = useCallback(() => {
    writeSession(BANNER_DISMISS_KEY, "1");
    setBannerDismissed(true);
  }, []);

  useEffect(() => {
    if (active) document.body.classList.add("is-table-mode");
    else document.body.classList.remove("is-table-mode");
    return () => document.body.classList.remove("is-table-mode");
  }, [active]);

  return (
    <TableModeContext.Provider value={{ active, bannerDismissed, activate, dismissBanner }}>
      {children}
    </TableModeContext.Provider>
  );
}

export function useTableMode() {
  return useContext(TableModeContext);
}
