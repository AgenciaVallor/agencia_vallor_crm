import { useState, useEffect, useCallback } from "react";
import { BarChart2, TrendingUp, Users, Target, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const PURPLE_SHADES = ["#7c3aed", "#a78bfa", "#5b21b6", "#c4b5fd", "#4c1d95", "#8b5cf6", "#ddd6fe"];

const TEMP_COLORS: Record<string, string> = {
  Fervendo: "#ef4444",
  Quente: "#f97316",
  Morno: "#eab308",
  Frio: "#3b82f6",
  Desinteressado: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  Novo: "#64748b",
  Contato: "#38bdf8",
  Negociando: "#a78bfa",
  Proposta: "#fbbf24",
  Ganho: "#34d399",
  Perdido: "#f87171",
};

type Lead = {
  nicho: string;
  temperatura: string;
  status_funil: string;
  created_at: string;
};

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-5 space-y-2">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-purple-500/20 bg-[#0f172a] p-3 text-xs shadow-xl">
      {label && <p className="font-semibold text-white mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || "#a78bfa" }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function InsightsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("nicho, temperatura, status_funil, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Leads por nicho (top 10)
  const nichoMap = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.nicho] = (acc[l.nicho] || 0) + 1;
    return acc;
  }, {});
  const nichoData = Object.entries(nichoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // Leads por temperatura
  const tempMap = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.temperatura] = (acc[l.temperatura] || 0) + 1;
    return acc;
  }, {});
  const tempData = Object.entries(tempMap).map(([name, value]) => ({ name, value }));

  // Funil de conversão
  const statusMap = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status_funil] = (acc[l.status_funil] || 0) + 1;
    return acc;
  }, {});
  const funnelData = ["Novo", "Contato", "Negociando", "Proposta", "Ganho", "Perdido"]
    .map(name => ({ name, value: statusMap[name] || 0 }));

  // Evolução diária (últimos 30 dias)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    return format(d, "yyyy-MM-dd");
  });
  const dailyMap = leads.reduce<Record<string, number>>((acc, l) => {
    const day = l.created_at.slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const dailyData = days.map(day => ({
    date: format(new Date(day + "T00:00:00"), "dd/MM", { locale: ptBR }),
    leads: dailyMap[day] || 0,
  }));

  const totalGanho = statusMap["Ganho"] || 0;
  const taxa = leads.length > 0 ? ((totalGanho / leads.length) * 100).toFixed(1) : "0";

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a]">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0f172a] shrink-0">
        <SidebarTrigger className="text-slate-400 hover:text-white" />
        <div className="h-5 w-px bg-white/10" />
        <h1 className="text-sm font-semibold text-white">Insights</h1>
        {loading && <Loader2 className="h-4 w-4 text-purple-400 animate-spin ml-2" />}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Insights & Métricas</h2>
          <p className="text-sm text-slate-400 mt-1">Visão geral do desempenho do seu funil</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Total de Leads" value={leads.length} sub="na sua base" />
          <StatCard icon={TrendingUp} label="Leads Ganhos" value={totalGanho} sub="convertidos" />
          <StatCard icon={Target} label="Taxa de Conversão" value={`${taxa}%`} sub="ganhos / total" />
          <StatCard icon={BarChart2} label="Nichos Ativos" value={Object.keys(nichoMap).length} sub="segmentos" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Leads por Nicho */}
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-5">
            <h3 className="text-sm font-bold text-white mb-4">Top 10 Nichos</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={nichoData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Leads" fill="#7c3aed" radius={[0, 4, 4, 0]}>
                    {nichoData.map((_, i) => (
                      <Cell key={i} fill={PURPLE_SHADES[i % PURPLE_SHADES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Leads por Temperatura */}
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-5">
            <h3 className="text-sm font-bold text-white mb-4">Leads por Temperatura</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={tempData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                  >
                    {tempData.map((entry, i) => (
                      <Cell key={i} fill={TEMP_COLORS[entry.name] || PURPLE_SHADES[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evolução Diária */}
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-5">
            <h3 className="text-sm font-bold text-white mb-4">Capturas nos Últimos 30 Dias</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#a78bfa" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Funil de Conversão */}
          <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-5">
            <h3 className="text-sm font-bold text-white mb-4">Funil de Vendas</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || "#7c3aed"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
