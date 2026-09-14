import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n/index.js";
import "./index.css";
import App from "./App.jsx";
import { supabase } from "./lib/supabase.js";
import { useStore } from "./store/useStore.js";

// Apply the saved theme before the first paint so the app never flashes the
// wrong palette on reload.
document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");

// Keep the store in sync with Supabase auth (e.g. token refresh / sign-out).
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    useStore.getState().setUser(null);
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
