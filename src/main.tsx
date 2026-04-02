import "./index.css";
import "./i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Disable default browser context menu (Inspect, Save As, Print, etc.)
// Custom context menus (e.g. friend list right-click) use e.preventDefault() + own UI
document.addEventListener("contextmenu", (e) => {
  // Allow context menu on input/textarea for copy-paste
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
