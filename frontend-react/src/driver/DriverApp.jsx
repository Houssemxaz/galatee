import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { fetchDriverMe } from "./api";
import DriverLoginPage from "./DriverLoginPage.jsx";
import DriverHomePage from "./DriverHomePage.jsx";
import DriverStatsPage from "./DriverStatsPage.jsx";
import "./driver.css";

// Bascule dynamiquement le manifest / theme-color en entrant dans la PWA
// livreur pour que "Ajouter à l écran d accueil" installe la bonne app.
function useDriverPwaChrome() {
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const prevManifest = manifestLink?.getAttribute("href");
    const prevTheme = themeMeta?.getAttribute("content");
    if (manifestLink) manifestLink.setAttribute("href", "/livreur.webmanifest");
    if (themeMeta) themeMeta.setAttribute("content", "#11140F");
    return () => {
      if (manifestLink && prevManifest) manifestLink.setAttribute("href", prevManifest);
      if (themeMeta && prevTheme) themeMeta.setAttribute("content", prevTheme);
    };
  }, []);
}

export default function DriverApp() {
  useDriverPwaChrome();
  const [driver, setDriver] = useState(null);
  const [state, setState] = useState("loading");

  const refresh = useCallback(async () => {
    try {
      const payload = await fetchDriverMe();
      setDriver(payload.driver || null);
      setState("ready");
    } catch (error) {
      if (error.status === 401) {
        setDriver(null);
        setState("ready");
      } else {
        setState("error");
      }
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (state === "loading") {
    return (
      <div className="pbg-drv-shell pbg-drv-loader">
        <div className="pbg-drv-spinner" aria-hidden="true" />
        <p>Chargement…</p>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="pbg-drv-shell">
        <Routes>
          <Route path="/login" element={<DriverLoginPage onLoggedIn={refresh} />} />
          <Route path="*" element={<Navigate to="/livreur/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="pbg-drv-shell">
      <Routes>
        <Route path="/" element={<DriverHomePage driver={driver} onDriverUpdated={setDriver} onLoggedOut={() => setDriver(null)} />} />
        <Route path="/stats" element={<DriverStatsPage driver={driver} />} />
        <Route path="/login" element={<Navigate to="/livreur" replace />} />
        <Route path="*" element={<Navigate to="/livreur" replace />} />
      </Routes>
    </div>
  );
}
