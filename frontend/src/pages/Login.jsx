import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Lock, ExternalLink, UserPlus, User, AtSign, ArrowLeft } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { auth as authApi } from "../lib/api.js";
import AnimatedLogo from "../components/AnimatedLogo.jsx";

function GlowBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-red-600/30 blur-[120px] animate-float1" />
      <div className="absolute top-1/3 -right-40 w-[470px] h-[470px] rounded-full bg-red-900/25 blur-[120px] animate-float2" />
      <div className="absolute -bottom-40 left-1/4 w-[420px] h-[420px] rounded-full bg-red-500/20 blur-[120px] animate-float3" />
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-red-800/10 blur-[80px] animate-float1" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

const fieldAnim = (delay) => ({
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  transition: { delay, duration: 0.4 },
});

export default function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, register, user, settings, loadSettings, language, setLanguage } = useStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The very first run of the application has no account at all. While no
  // administrator exists the registration button is offered; as soon as one is
  // created it disappears for good.
  const [adminExists, setAdminExists] = useState(true);
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [reg, setReg] = useState({ fullName: "", username: "", email: "", password: "", confirm: "" });

  useEffect(() => {
    loadSettings();
    authApi.adminExists().then(setAdminExists).catch(() => setAdminExists(true));
    if (user) navigate("/app/dashboard");
  }, [user]);

  const doLogin = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app/dashboard");
    } catch (err) {
      setError(err.message || t("login.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async (e) => {
    e?.preventDefault();
    setError("");
    if (reg.password !== reg.confirm) {
      setError(t("login.passwordMismatch"));
      return;
    }
    if (reg.password.length < 6) {
      setError(t("login.passwordTooShort"));
      return;
    }
    setLoading(true);
    try {
      await register({
        fullName: reg.fullName,
        username: reg.username || reg.email.split("@")[0],
        email: reg.email,
        password: reg.password,
      });
      setAdminExists(true);
      navigate("/app/dashboard");
    } catch (err) {
      setError(err.message || t("login.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const setRegField = (f) => (e) => setReg((r) => ({ ...r, [f]: e.target.value }));

  const toggleLang = () => {
    const next = language === "fr" ? "ar" : "fr";
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative px-4">
      <GlowBackground />

      {/* Top bar */}
      <div className="absolute top-5 right-5 rtl:right-auto rtl:left-5 flex items-center gap-3 z-10">
        <a href="/website" target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1.5">
          <ExternalLink size={14} /> {t("login.viewWebsite")}
        </a>
        <motion.button onClick={toggleLang} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }} className="chip overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span key={language} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.2 }}>
              {language === "fr" ? "FR | AR" : "AR | FR"}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-[420px] p-8 rounded-panel"
        style={{
          background: "rgba(15,2,2,0.92)",
          border: "1px solid rgba(220,38,38,0.45)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 0 80px rgba(220,38,38,0.15)",
        }}
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.2 }}
      >
        <div className="flex flex-col items-center mb-7">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 20, delay: 0.35 }}
            whileHover={{ scale: 1.08 }}
            className="mb-3"
          >
            <AnimatedLogo src={settings?.logo} size={72} rounded="rounded-2xl" />
          </motion.div>
          <motion.p className="text-text-muted text-xs uppercase tracking-[0.2em]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            {settings?.name || "Prestige Auto"}
          </motion.p>
          <motion.h1 className="gradient-text heading text-4xl mt-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            {mode === "register" ? t("login.createAdmin") : t("login.title")}
          </motion.h1>
        </div>

        {mode === "register" ? (
          <form onSubmit={doRegister} className="space-y-4">
            <p className="text-xs text-text-muted text-center -mt-2 mb-1">{t("login.createAdminHelp")}</p>

            <motion.div {...fieldAnim(0.05)}>
              <label className="label-caps text-red-400/80">{t("login.fullName")}</label>
              <div className="relative">
                <User className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
                <input className="input pl-10 rtl:pl-3 rtl:pr-10" value={reg.fullName} onChange={setRegField("fullName")} required />
              </div>
            </motion.div>

            <motion.div {...fieldAnim(0.1)}>
              <label className="label-caps text-red-400/80">{t("login.username")}</label>
              <div className="relative">
                <AtSign className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
                <input className="input pl-10 rtl:pl-3 rtl:pr-10" value={reg.username} onChange={setRegField("username")} />
              </div>
            </motion.div>

            <motion.div {...fieldAnim(0.15)}>
              <label className="label-caps text-red-400/80">{t("login.email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
                <input className="input pl-10 rtl:pl-3 rtl:pr-10" type="email" value={reg.email} onChange={setRegField("email")} required />
              </div>
            </motion.div>

            <motion.div {...fieldAnim(0.2)}>
              <label className="label-caps text-red-400/80">{t("login.password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
                <input className="input pl-10 rtl:pl-3 rtl:pr-10" type="password" value={reg.password} onChange={setRegField("password")} required />
              </div>
            </motion.div>

            <motion.div {...fieldAnim(0.25)}>
              <label className="label-caps text-red-400/80">{t("login.confirmPassword")}</label>
              <div className="relative">
                <Lock className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
                <input className="input pl-10 rtl:pl-3 rtl:pr-10" type="password" value={reg.confirm} onChange={setRegField("confirm")} required />
              </div>
            </motion.div>

            {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

            <motion.button type="submit" disabled={loading} className="btn-primary w-full shine-btn" {...fieldAnim(0.3)} whileTap={{ scale: 0.97 }}>
              {loading ? "..." : <><UserPlus size={15} /> {t("login.register")}</>}
            </motion.button>

            <button type="button" onClick={() => { setMode("login"); setError(""); }} className="btn-ghost w-full">
              <ArrowLeft size={14} /> {t("common.back")}
            </button>
          </form>
        ) : (
        <form onSubmit={doLogin} className="space-y-4">
          <motion.div {...fieldAnim(0.7)}>
            <label className="label-caps text-red-400/80">{t("login.email")}</label>
            <div className="relative">
              <Mail className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
              <input className="input pl-10 rtl:pl-3 rtl:pr-10" type="text" placeholder="exemple@showroom.dz" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </motion.div>
          <motion.div {...fieldAnim(0.78)}>
            <label className="label-caps text-red-400/80">{t("login.password")}</label>
            <div className="relative">
              <Lock className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-red-500/70" size={16} />
              <input className="input pl-10 rtl:pl-3 rtl:pr-10" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </motion.div>

          {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

          <motion.button
            type="submit"
            disabled={loading}
            className="btn-primary w-full shine-btn"
            {...fieldAnim(0.86)}
            whileHover={{ scale: 1.02, boxShadow: "0 8px 40px rgba(220,38,38,0.55)" }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? "..." : t("login.submit")}
          </motion.button>

          {/* Only offered while the showroom has no administrator yet */}
          {!adminExists && (
            <motion.div className="pt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-red-600/25" />
                <span className="text-[0.62rem] uppercase tracking-widest text-text-muted">{t("login.or")}</span>
                <div className="flex-1 h-px bg-red-600/25" />
              </div>
              <button type="button" className="btn-ghost w-full" onClick={() => { setMode("register"); setError(""); }}>
                <UserPlus size={15} /> {t("login.createAdmin")}
              </button>
            </motion.div>
          )}
        </form>
        )}
      </motion.div>
    </div>
  );
}
