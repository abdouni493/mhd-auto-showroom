import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import {
  Car, CheckCircle, Clock, Tag, Users, Receipt, HardHat,
  CalendarClock, EyeOff, ShoppingCart, Wallet, TrendingUp, HandCoins, ChevronRight,
  Scale, CircleDollarSign,
} from "lucide-react";
import { useFetch } from "../hooks/useApi.js";
import { dashboardApi } from "../lib/api.js";
import { StatCard, Card, Badge, SkeletonGrid } from "../components/ui.jsx";
import { CarImage } from "../components/CarCard.jsx";
import { formatAmount, formatDate, STATUS_LABELS } from "../utils/format.js";
import { useCan } from "../lib/permissions.js";

const PIE_COLORS = { AVAILABLE: "#10b981", SOLD: "#dc2626", RESERVED: "#f59e0b" };

function ChartCard({ title, children, className = "", index = 0 }) {
  return (
    <motion.div
      className={`glass-card p-5 ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.12 }}
    >
      <h3 className="heading text-sm text-text-primary mb-4">{title}</h3>
      {children}
    </motion.div>
  );
}

// Small money-free metric tile used in the secondary "operations" grid.
function MiniStat({ icon: Icon, label, value, color = "text-text-primary", index = 0 }) {
  return (
    <motion.div
      className="glass-card p-4 flex items-center gap-3"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
    >
      <div className={`p-2.5 rounded-xl bg-white/5 ${color}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
        <p className="label-caps mt-1 truncate">{label}</p>
      </div>
    </motion.div>
  );
}

const tooltipStyle = {
  background: "#0a0a0f",
  border: "1px solid rgba(220,38,38,0.4)",
  borderRadius: "12px",
  color: "#fee2e2",
  fontSize: "12px",
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const { data, loading } = useFetch(() => dashboardApi.stats(), []);

  if (loading || !data) {
    return (
      <div>
        <h1 className="heading text-3xl text-text-primary mb-6">{t("dashboard.title")}</h1>
        <SkeletonGrid count={8} />
      </div>
    );
  }

  const { counts, charts, lists, workers, website } = data;
  const settlements = data.settlements || { pending: [], count: 0, total: 0 };
  const caisse = data.caisse || { totalGains: 0, totalExpenses: 0, net: 0 };
  const caissePositive = caisse.net >= 0;
  const pieData = Object.entries(charts.statusDistribution).map(([k, v]) => ({ name: STATUS_LABELS[k], key: k, value: v }));

  return (
    <div>
      <h1 className="heading text-3xl text-text-primary mb-6">{t("dashboard.title")}</h1>

      {/* Owner règlements waiting to be created (client vehicles already sold) */}
      {settlements.count > 0 && can("clients", "view") && (
        <motion.button
          onClick={() => navigate("/app/clients?settle=1")}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          className="w-full text-left rtl:text-right glass-card p-4 mb-6 border border-amber-500/45 bg-amber-500/5 flex items-center gap-4"
        >
          <motion.span
            className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 shrink-0"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <HandCoins size={22} />
          </motion.span>
          <div className="flex-1 min-w-0">
            <p className="heading text-sm text-amber-400">{t("settlements.alertTitle")}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {t("settlements.alertDesc", { count: settlements.count })}
              {settlements.total > 0 && ` · ${t("settlements.ownerAmount")} : ${formatAmount(settlements.total)}`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {settlements.pending.slice(0, 4).map((s) => (
                <span key={s.saleId} className="text-[0.65rem] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {s.car?.brand} {s.car?.model} — {s.client?.firstName} {s.client?.lastName}
                </span>
              ))}
              {settlements.pending.length > 4 && (
                <span className="text-[0.65rem] px-2 py-0.5 text-text-muted">
                  +{settlements.pending.length - 4}
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={20} className="text-amber-400 shrink-0" />
        </motion.button>
      )}

      {/* Caisse — the net result card of the Caisse page, mirrored here */}
      {can("caisse", "view") && (
        <motion.button
          onClick={() => navigate("/app/caisse")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          className="w-full text-left rtl:text-right glass-card p-5 mb-6 border border-red-600/30 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center"
        >
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0"><TrendingUp size={20} /></span>
            <div className="min-w-0">
              <p className="label-caps">{t("caisse.totalGains")}</p>
              <p className="text-xl font-black text-emerald-400">{formatAmount(caisse.totalGains)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 shrink-0"><CircleDollarSign size={20} /></span>
            <div className="min-w-0">
              <p className="label-caps">{t("caisse.totalExpenses")}</p>
              <p className="text-xl font-black text-amber-400">{formatAmount(caisse.totalExpenses)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl shrink-0 ${caissePositive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
              <Scale size={20} />
            </span>
            <div className="min-w-0">
              <p className="label-caps">{t("caisse.netResult")}</p>
              <p className={`text-2xl font-black ${caissePositive ? "text-emerald-400" : "text-rose-400"}`}>
                {caissePositive ? "+" : ""}{formatAmount(caisse.net)}
              </p>
              <p className="text-[0.65rem] text-text-muted">{t("caisse.netFormula")}</p>
            </div>
          </div>
        </motion.button>
      )}

      {/* Inventory KPIs (counts only — no money) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard index={0} label={t("dashboard.totalCars")} value={counts.totalCars} icon={Car} color="accent" />
        <StatCard index={1} label={t("dashboard.carsInStock")} value={counts.available} icon={CheckCircle} color="success" />
        <StatCard index={2} label={t("dashboard.reserved")} value={counts.reserved} icon={Clock} color="warning" />
        <StatCard index={3} label={t("dashboard.soldTotal")} value={counts.sold} icon={Tag} color="info" />
        <StatCard index={4} label={t("dashboard.clients")} value={counts.totalClients} icon={Users} color="info" />
        <StatCard index={5} label={t("dashboard.workers")} value={counts.totalWorkers} icon={HardHat} color="warning" />
        <StatCard index={6} label={t("dashboard.soldThisMonth")} value={counts.soldThisMonth} icon={TrendingUp} color="success" />
      </div>

      {/* Charts (activity counts + status mix — no money) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <ChartCard index={0} title={t("dashboard.activityPerMonth")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(220,38,38,0.1)" />
              <XAxis dataKey="label" stroke="rgba(248,113,113,0.5)" fontSize={11} />
              <YAxis stroke="rgba(248,113,113,0.5)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="purchases" fill="#7c3aed" name={t("dashboard.purchases")} radius={[4, 4, 0, 0]} />
              <Bar dataKey="sales" fill="#10b981" name={t("dashboard.sales")} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard index={1} title={t("dashboard.carStatus")}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {pieData.map((entry) => (
                  <Cell key={entry.key} fill={PIE_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Operations overview (counts) */}
      <h2 className="heading text-sm text-text-muted uppercase tracking-wider mb-3">{t("dashboard.operations")}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <MiniStat index={0} icon={ShoppingCart} label={t("dashboard.totalPurchases")} value={counts.totalPurchases} color="text-violet-400" />
        <MiniStat index={1} icon={Receipt} label={t("dashboard.totalSales")} value={counts.totalSales} color="text-emerald-400" />
        <MiniStat index={2} icon={Wallet} label={t("dashboard.totalExpenses")} value={counts.totalExpenses} color="text-amber-400" />
        <MiniStat index={3} icon={Users} label={t("dashboard.clientsInDebt")} value={counts.clientsInDebt} color="text-rose-300" />
        <MiniStat index={4} icon={ShoppingCart} label={t("dashboard.purchasesInDebt")} value={counts.purchasesInDebt} color="text-rose-300" />
        <MiniStat index={5} icon={CalendarClock} label={t("dashboard.pendingReservations")} value={website.pendingReservations} color="text-amber-400" />
        <MiniStat index={6} icon={HandCoins} label={t("settlements.pendingLabel")} value={settlements.count} color="text-amber-400" />
      </div>

      {/* Recent activity lists (no amounts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <Card className="p-5">
          <h3 className="heading text-sm text-text-primary mb-4">{t("dashboard.lastPurchases")}</h3>
          <div className="space-y-3">
            {lists.lastPurchases.length === 0 && <p className="text-text-muted text-sm">{t("common.noData")}</p>}
            {lists.lastPurchases.map((p, i) => (
              <motion.div key={p.id} className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="w-12 h-9 rounded-lg overflow-hidden shrink-0"><CarImage images={p.car?.images} heightClass="h-9" fit="cover" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate font-medium">{p.car?.brand} {p.car?.model}</p>
                  <p className="text-xs text-text-muted truncate">{p.client ? `${p.client.firstName} ${p.client.lastName}` : t("purchase.sourceShowroom")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-text-muted">{formatDate(p.date)}</p>
                  {p.amountRest > 0 && <Badge color="debt">{t("dashboard.debt")}</Badge>}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="heading text-sm text-text-primary mb-4">{t("dashboard.lastSales")}</h3>
          <div className="space-y-3">
            {lists.lastSales.length === 0 && <p className="text-text-muted text-sm">{t("common.noData")}</p>}
            {lists.lastSales.map((s, i) => (
              <motion.div key={s.id} className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="w-12 h-9 rounded-lg overflow-hidden shrink-0"><CarImage images={s.car?.images} heightClass="h-9" fit="cover" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate font-medium">{s.client?.firstName} {s.client?.lastName}</p>
                  <p className="text-xs text-text-muted truncate">{s.car?.brand} {s.car?.model}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-text-muted">{formatDate(s.date)}</p>
                  {s.amountRest > 0 ? <Badge color="debt">{t("dashboard.debt")}</Badge> : <Badge color="success">{t("purchase.filterPaid")}</Badge>}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="heading text-sm text-text-primary mb-4">{t("dashboard.lastExpenses")}</h3>
          <div className="space-y-3">
            {lists.lastExpenses.length === 0 && <p className="text-text-muted text-sm">{t("common.noData")}</p>}
            {lists.lastExpenses.map((e, i) => (
              <motion.div key={e.id} className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="p-2 rounded-lg bg-white/5 text-amber-400 shrink-0"><Receipt size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate font-medium">{e.name}</p>
                  <p className="text-xs text-text-muted truncate">{e.type === "CAR" ? (e.car ? `${e.car.brand} ${e.car.model}` : t("common.vehicle")) : "Showroom"}</p>
                </div>
                <p className="text-xs text-text-muted shrink-0">{formatDate(e.date)}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      {/* Workforce + website (counts only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="heading text-sm text-text-primary mb-4">{t("dashboard.workers")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center"><HardHat className="mx-auto text-amber-400 mb-1" size={22} /><p className="text-2xl font-black text-text-primary">{workers.count}</p><p className="label-caps">{t("dashboard.workers")}</p></div>
            <div className="text-center"><Users className="mx-auto text-blue-400 mb-1" size={22} /><p className="text-2xl font-black text-blue-400">{counts.totalClients}</p><p className="label-caps">{t("dashboard.clients")}</p></div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="heading text-sm text-text-primary mb-4">{t("dashboard.website")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center"><CalendarClock className="mx-auto text-amber-400 mb-1" size={22} /><p className="text-2xl font-black text-amber-400">{website.pendingReservations}</p><p className="label-caps">{t("dashboard.pendingReservations")}</p></div>
            <div className="text-center"><EyeOff className="mx-auto text-text-muted mb-1" size={22} /><p className="text-2xl font-black text-text-primary">{website.hiddenOffers}</p><p className="label-caps">{t("dashboard.hiddenOffers")}</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
