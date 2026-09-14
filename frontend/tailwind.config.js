/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        black: "#000000",
        surface: "#0a0a0f",
        glass: "rgba(15,2,2,0.95)",
        accent: "#dc2626",
        "accent-dark": "#991b1b",
        "text-primary": "#fee2e2",
        "text-muted": "rgba(248,113,113,0.70)",
        success: "#10b981",
        warning: "#f59e0b",
        info: "#3b82f6",
        debt: "#fb7185",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1.5rem",
        panel: "2rem",
      },
      keyframes: {
        float1: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(40px,-30px) scale(1.1)" },
        },
        float2: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-30px,40px) scale(1.15)" },
        },
        float3: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(20px,30px) scale(0.95)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        shine: {
          "0%": { left: "-60%" },
          "100%": { left: "140%" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(20px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        scaleIn: { "0%": { transform: "scale(0.92)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        pulse: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".5" } },
      },
      animation: {
        float1: "float1 8s ease-in-out infinite",
        float2: "float2 12s ease-in-out infinite",
        float3: "float3 10s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        shine: "shine 3s ease-in-out infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "scale-in": "scaleIn 0.25s ease-out",
        "pulse-slow": "pulse 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
