import { useState, useEffect, useCallback } from "react";
import {
  Users, MessageCircle, Mail, Plus, Library, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";

interface StatsState {
  total: number;
  comWhatsApp: number;
  comEmail: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsState>({ total: 0, comWhatsApp: 0, comEmail: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    setLoadingStats(true);
    try {
      const [totalRes, whatsRes, emailRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("whatsapp", "is", null),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("email", "is", null),
      ]);

      setStats({
        total: totalRes.count ?? 0,
        comWhatsApp: whatsRes.count ?? 0,
        comEmail: emailRes.count ?? 0,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-[#0f111a] shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">CRM VALLOR — Dashboard</h1>
      </header>

      <div className="flex-1 p-6 space-y-8 max-w-7xl mx-auto w-full">
        {/* BOAS VINDAS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta! 🚀</h2>
            <p className="text-muted-foreground text-sm">Gerencie seus leads e conexões de WhatsApp em um só lugar.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/biblioteca" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[hsl(var(--vallor-purple))] hover:bg-[hsl(var(--vallor-purple-light))] text-white text-sm font-bold transition-all shadow-lg active:scale-95">
              <Plus className="h-4 w-4" />
              Importar Lista
            </Link>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="Total de Leads"
            value={loadingStats ? "..." : stats.total.toLocaleString("pt-BR")}
            color="blue"
          />
          <StatCard
            icon={<MessageCircle className="h-6 w-6" />}
            label="Com WhatsApp"
            value={loadingStats ? "..." : stats.comWhatsApp.toLocaleString("pt-BR")}
            color="green"
          />
          <StatCard
            icon={<Mail className="h-6 w-6" />}
            label="Com E-mail"
            value={loadingStats ? "..." : stats.comEmail.toLocaleString("pt-BR")}
            color="purple"
          />
        </div>

        {/* ATALHOS RÁPIDOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <Link to="/agente-ia" className="group p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/[0.08] transition-all space-y-4">
            <div className="h-12 w-12 rounded-xl bg-[hsl(var(--vallor-purple)/0.2)] border border-[hsl(var(--vallor-purple)/0.3)] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="h-6 w-6 text-[hsl(var(--vallor-purple-light))]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Agente IA SDR</h3>
              <p className="text-sm text-muted-foreground">Configure os modos Ativo e Receptivo para seus chips de WhatsApp conectados.</p>
            </div>
          </Link>

          <Link to="/biblioteca" className="group p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/[0.08] transition-all space-y-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Library className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Biblioteca de Leads</h3>
              <p className="text-sm text-muted-foreground">Acesse sua base de leads importada, aplique filtros e organize seu funil de vendas.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "blue" | "green" | "purple" }) {
  const colors = {
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", icon: "bg-blue-500/20 text-blue-400" },
    green: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "bg-emerald-500/20 text-emerald-400" },
    purple: { bg: "bg-[hsl(var(--vallor-purple)/0.1)]", border: "border-[hsl(var(--vallor-purple)/0.2)]", text: "text-[hsl(var(--vallor-purple-light))]", icon: "bg-[hsl(var(--vallor-purple)/0.2)] text-[hsl(var(--vallor-purple-light))]" },
  };
  const c = colors[color];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-6 flex items-center gap-5 transition-all hover:scale-[1.02]`}>
      <div className={`h-14 w-14 rounded-xl ${c.icon} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-3xl font-black ${c.text} mt-1 leading-tight tracking-tight`}>{value}</p>
      </div>
    </div>
  );
}
