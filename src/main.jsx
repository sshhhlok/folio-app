import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Theme palette (light default). CSS variables flip instantly via [data-theme].
const palette = document.createElement("style");
palette.textContent = `
:root, [data-theme="light"] {
  --c-bg:#F6F7F4; --c-surface:#FFFFFF; --c-surface2:#F0F1EC; --c-border:#E4E5DE;
  --c-text:#1B1E23; --c-muted:#5C636C; --c-faint:#9AA0A8;
  --c-gold:#B07D14; --c-pos:#1F9D57; --c-neg:#C8362E;
}
[data-theme="dark"] {
  --c-bg:#0E1116; --c-surface:#161B22; --c-surface2:#1C232C; --c-border:#262E38;
  --c-text:#E6E9ED; --c-muted:#8B95A1; --c-faint:#5A6573;
  --c-gold:#D4A84B; --c-pos:#3FB950; --c-neg:#E5534B;
}
html, body, #root { height:100%; margin:0; background:var(--c-bg); }
* { box-sizing:border-box; }
`;
document.head.appendChild(palette);

const saved = (() => { try { return localStorage.getItem("folio_theme"); } catch { return null; } })();
document.documentElement.dataset.theme = saved || "light";

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
