import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, UserCog, Database, Download, Upload } from "lucide-react";
import { settingsApi, auth as authApi } from "../lib/api.js";
import { useStore } from "../store/useStore.js";
import { useCan } from "../lib/permissions.js";
import { Card, Field } from "../components/ui.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { SingleImageUpload } from "../components/ImageUpload.jsx";
import { BUCKETS } from "../lib/supabase.js";

const TABS = [
  { key: "showroom", label: "Showroom", icon: Building2 },
  { key: "account", label: "Mon Compte", icon: UserCog },
  { key: "database", label: "Base de Données", icon: Database },
];

export default function Settings() {
  const can = useCan();
  const { settings, setSettings, user, setUser, loadSettings } = useStore();
  const [tab, setTab] = useState("showroom");
  const [form, setForm] = useState({});
  const [account, setAccount] = useState({ fullName: "", username: "", email: "", password: "", confirm: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  useEffect(() => { if (user) setAccount((a) => ({ ...a, fullName: user.fullName, username: user.username, email: user.email })); }, [user]);

  const saveShowroom = async () => {
    const data = await settingsApi.update(form);
    setSettings(data);
    flash("Showroom enregistré ✓");
  };

  const saveAccount = async () => {
    if (account.password && account.password !== account.confirm) { flash("Les mots de passe ne correspondent pas"); return; }
    const payload = { fullName: account.fullName, username: account.username, email: account.email };
    if (account.password) payload.password = account.password;
    try {
      const user = await authApi.updateProfile(payload);
      setUser(user);
      flash("Compte mis à jour ✓");
    } catch (e) {
      flash(e.message || "Erreur lors de la mise à jour");
    }
  };

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const backup = async () => {
    const data = await settingsApi.backup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `showroom-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Sauvegarde téléchargée ✓");
  };

  return (
    <div>
      <PageHeader title="Paramètres" />

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tb) => (
          <motion.button
            key={tb.key}
            whileTap={{ scale: 0.96 }}
            className={`relative chip ${tab === tb.key ? "text-white border-transparent" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tab === tb.key && (
              <motion.span
                layoutId="settings-tab-indicator"
                className="absolute inset-0 rounded-full"
                style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1"><tb.icon size={13} /> {tb.label}</span>
          </motion.button>
        ))}
      </div>

      {msg && <div className="mb-4"><Card className="px-4 py-2 border-emerald-500/40"><span className="text-emerald-400 text-sm">{msg}</span></Card></div>}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      {tab === "showroom" && (
        <Card className="p-6 max-w-2xl">
          <div className="mb-5"><SingleImageUpload value={form.logo} onChange={(url) => setForm({ ...form, logo: url })} label="Logo" size={120} bucket={BUCKETS.showroomLogo} fit="contain" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom du showroom" required className="sm:col-span-2"><input className="input" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea className="input" rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Téléphone"><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Téléphone 2"><input className="input" value={form.phone2 || ""} onChange={(e) => setForm({ ...form, phone2: e.target.value })} placeholder="Numéro secondaire" /></Field>
            <Field label="Téléphone 3"><input className="input" value={form.phone3 || ""} onChange={(e) => setForm({ ...form, phone3: e.target.value })} placeholder="Troisième numéro" /></Field>
            <Field label="Adresse" className="sm:col-span-2"><input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="NIF"><input className="input" value={form.nif || ""} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></Field>
            <Field label="NIS"><input className="input" value={form.nis || ""} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></Field>
            <Field label="Article"><input className="input" value={form.article || ""} onChange={(e) => setForm({ ...form, article: e.target.value })} /></Field>
            <Field label="RC"><input className="input" value={form.rc || ""} onChange={(e) => setForm({ ...form, rc: e.target.value })} /></Field>
          </div>
          {can("settings", "edit") && <button className="btn-primary mt-5" onClick={saveShowroom}>Enregistrer</button>}
        </Card>
      )}

      {tab === "account" && (
        <Card className="p-6 max-w-lg">
          <div className="space-y-4">
            <Field label="Nom complet"><input className="input" value={account.fullName} onChange={(e) => setAccount({ ...account, fullName: e.target.value })} /></Field>
            <Field label="Nom d'utilisateur"><input className="input" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nouveau mot de passe"><input className="input" type="password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} /></Field>
              <Field label="Confirmer"><input className="input" type="password" value={account.confirm} onChange={(e) => setAccount({ ...account, confirm: e.target.value })} /></Field>
            </div>
          </div>
          <button className="btn-primary mt-5" onClick={saveAccount}>Enregistrer</button>
        </Card>
      )}

      {tab === "database" && (
        <Card className="p-6 max-w-lg">
          <p className="text-text-muted text-sm mb-5">Exportez toutes les données de l'application au format JSON, ou restaurez à partir d'une sauvegarde.</p>
          <div className="flex flex-col gap-3">
            <button className="btn-primary" onClick={backup}><Download size={16} /> Sauvegarder (Backup)</button>
            <button className="btn-ghost" onClick={() => flash("La restauration s'effectue côté serveur — fonctionnalité de démonstration.")}><Upload size={16} /> Restaurer</button>
          </div>
        </Card>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
