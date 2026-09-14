import { create } from "zustand";
import { auth as authApi, settingsApi, settlementsApi } from "../lib/api.js";

export const useStore = create((set, get) => ({
  user: null,
  settings: null,
  language: localStorage.getItem("lang") || "fr",
  theme: localStorage.getItem("theme") || "dark",
  authChecked: false,
  // Number of sold client vehicles whose owner has not been settled yet.
  // Feeds the dashboard alert, the sidebar badge and the Clients page banner.
  pendingSettlements: 0,

  setLanguage: (lang) => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    set({ language: lang });
  },

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),

  setPendingSettlements: (n) => set({ pendingSettlements: n }),

  async refreshSettlements() {
    try {
      const list = await settlementsApi.pending();
      set({ pendingSettlements: list.length });
      return list.length;
    } catch {
      return get().pendingSettlements;
    }
  },

  async loadMe() {
    try {
      const user = await authApi.getUser();
      set({ user, authChecked: true });
      if (user) {
        get().loadSettings();
        get().refreshSettlements();
      }
      return user;
    } catch {
      set({ user: null, authChecked: true });
      return null;
    }
  },

  async loadSettings() {
    try {
      const data = await settingsApi.get();
      if (data) set({ settings: data });
    } catch {
      /* settings are public; ignore failures */
    }
  },

  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),

  async login(email, password) {
    const user = await authApi.login(email, password);
    set({ user });
    get().loadSettings();
    get().refreshSettlements();
    return user;
  },

  async register(payload) {
    const user = await authApi.register(payload);
    set({ user });
    get().loadSettings();
    return user;
  },

  async logout() {
    await authApi.logout();
    set({ user: null, pendingSettlements: 0 });
  },
}));
