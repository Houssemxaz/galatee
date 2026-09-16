import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./backoffice.css";
import BackofficeApp from "./BackofficeApp.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BackofficeApp />
  </StrictMode>,
);
