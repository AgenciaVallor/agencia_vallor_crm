import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Users, MessageCircle, Globe, Calendar,
  Zap, TrendingUp, CheckCircle, Loader2, Shuffle, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NICHOS } from "@/data/nichos";
import { CategorizedNichoDropdown } from "@/components/CategorizedNichoDropdown";
import { ESTADOS } from "@/data/estados";
import { CIDADES_POR_ESTADO } from "@/data/cidades";
import { SearchableDropdown } from "@/components/SearchableDropdown";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "@/hooks/use-toast";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

interface StatsState {
  total: number;
  comWhatsApp: number;
  semSite: number;
  hoje: number;
}

const QUANTIDADES = [10, 20, 50, 100];
const MODOS = [
  "Todos os leads",
  "Com WhatsApp",
  "WhatsApp + Email",
  "Prioriza sem site",
  "Prioriza com site",
  "Apenas com site",
];

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [nicho, setNicho] = useState("");
  const [estadoSigla, setEstadoSigla] = useState("");
  const [cidade, setCidade] = useState("");
  const [sortear, setSortear] = useState(false);
  const [quantidade, setQuantidade] = useState(20);
  const [modo, setModo] = useState("Todos os leads");
  const [capturing, setCapturing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<StatsState>({ total: 0, comWhatsApp: 0, semSite: 0, hoje: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const estadoNome = ESTADOS.find((e) => e.sigla === estadoSigla)?.nome ?? "";

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    setLoadingStats(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalRes, whatsRes, siteRes, hojeRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("whatsapp", "is", null),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("site", null),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", today.toISOString()),
      ]);

      setStats({
        total: totalRes.count ?? 0,
        comWhatsApp: whatsRes.count ?? 0,
        semSite: siteRes.count ?? 0,
        hoje: hojeRes.count ?? 0,
      });
    } finally {
      setLoadingStats(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { id: crypto.randomUUID(), timestamp: now(), message, type }]);
  }, []);

  async function handleCapture() {
    if (!nicho || !estadoSigla || (!sortear && !cidade)) {
      addLog("⚠️ Preencha Nicho, Estado e Cidade antes de capturar.", "warn");
      return;
    }

    setCapturing(true);
    setLogs([]);

    const cidadeAlvo = sortear ? randomCidade(estadoSigla) : cidade;

    // ── Duplicate check: verify if this search was already done ──
    addLog(`🔎 Verificando buscas anteriores para "${nicho}" em ${cidadeAlvo}-${estadoSigla}...`, "info");
    try {
      const { count: existingCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user?.id)
        .ilike("nicho", nicho)
        .ilike("cidade", cidadeAlvo)
        .eq("estado", estadoSigla);

      if (existingCount && existingCount > 0) {
        addLog(`⚠️ Busca já realizada anteriormente. ${existingCount} leads similares encontrados.`, "warn");
        toast({
          title: "Busca duplicada",
          description: `Busca já realizada anteriormente para este nicho em ${cidadeAlvo}-${estadoSigla}. Existem ${existingCount} leads similares na Biblioteca.`,
          variant: "destructive",
        });
        setCapturing(false);
        return;
      }
      addLog(`✅ Nenhuma busca anterior encontrada. Prosseguindo...`, "success");
    } catch {
      addLog(`⚠️ Não foi possível verificar duplicatas. Prosseguindo...`, "warn");
    }

    addLog(`🔍 Iniciando busca no Google Maps (todas as páginas)...`, "info");
    addLog(`📍 Buscando "${nicho}" em ${cidadeAlvo} - ${estadoSigla}...`, "info");

    try {
      const { data, error } = await supabase.functions.invoke('google-maps-search', {
        body: { nicho, cidade: cidadeAlvo, estado: estadoSigla, maxResults: quantidade },
      });

      if (error) {
        addLog(`❌ Erro na API: ${error.message}`, "error");
        toast({ title: "Erro na captura", description: error.message, variant: "destructive" });
        setCapturing(false);
        return;
      }

      if (!data?.success) {
        addLog(`❌ ${data?.error ?? 'Erro desconhecido.'}`, "error");
        toast({ title: "Erro", description: data?.error, variant: "destructive" });
        setCapturing(false);
        return;
      }

      // Show server-side logs
      if (data.logs && Array.isArray(data.logs)) {
        for (const logMsg of data.logs) {
          const type: LogEntry["type"] = logMsg.includes("falhou") || logMsg.includes("Nenhum") || logMsg.includes("ignorado") ? "warn" : logMsg.includes("concluída") || logMsg.includes("Encontrado") ? "success" : "info";
          addLog(logMsg, type);
        }
      }

      const fonte = data.fonte ?? "Google";
      const allLeads = data.leads ?? [];
      const duplicatesSkipped = data.duplicatesSkipped ?? 0;

      if (allLeads.length === 0) {
        addLog(`⚠️ Nenhum resultado encontrado para "${nicho}" em ${cidadeAlvo}.`, "warn");
        toast({ title: "Sem resultados", description: "Nenhum lead encontrado nas fontes disponíveis. Tente outro nicho/cidade.", variant: "destructive" });
        setCapturing(false);
        return;
      }

      if (duplicatesSkipped > 0) {
        addLog(`🔄 ${duplicatesSkipped} leads duplicados ignorados.`, "warn");
      }

      // Apply capture mode filter
      let filtered = [...allLeads];
      if (modo === "Com WhatsApp") filtered = allLeads.filter((l: any) => l.whatsapp);
      else if (modo === "WhatsApp + Email") filtered = allLeads.filter((l: any) => l.whatsapp && l.email);
      else if (modo === "Prioriza sem site") filtered = [...allLeads].sort((a: any, b: any) => (a.site ? 1 : -1) - (b.site ? 1 : -1));
      else if (modo === "Prioriza com site") filtered = [...allLeads].sort((a: any, b: any) => (b.site ? 1 : 0) - (a.site ? 1 : 0));
      else if (modo === "Apenas com site") filtered = allLeads.filter((l: any) => l.site);

      addLog(`🌡️ Classificando temperatura dos leads...`, "info");

      const fervendo = filtered.filter((l: any) => l.temperatura === "Fervendo").length;
      const quente = filtered.filter((l: any) => l.temperatura === "Quente").length;
      const morno = filtered.filter((l: any) => l.temperatura === "Morno").length;
      addLog(`🌡️ 🔥 ${fervendo} Fervendo | ♨️ ${quente} Quente | 🌡️ ${morno} Morno`, "info");

      addLog(`💾 Salvando ${filtered.length} leads no banco...`, "info");

      const leadsWithUser = filtered.map((l: any) => ({
        nome_empresa: l.nome_empresa ?? '',
        nicho: l.nicho ?? nicho,
        cidade: l.cidade ?? cidadeAlvo,
        estado: l.estado ?? estadoSigla,
        telefone: l.telefone ?? null,
        whatsapp: l.whatsapp ?? null,
        email: l.email ?? null,
        site: l.site ?? null,
        fonte: l.fonte ?? fonte,
        status_funil: l.status_funil ?? 'Novo',
        temperatura: l.temperatura ?? 'Frio',
        endereco: l.endereco ?? null,
        instagram: l.instagram ?? null,
        linkedin: l.linkedin ?? null,
        observacoes: l.observacoes ?? null,
        user_id: user?.id,
      }));

      const { error: insertErr } = await supabase.from("leads").insert(leadsWithUser);

      if (insertErr) {
        addLog(`❌ Erro ao salvar: ${insertErr.message}`, "error");
      } else {
        addLog(`✅ Captura concluída! ${filtered.length} leads salvos no banco (fonte: ${fonte}).`, "success");
        await fetchStats();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      addLog(`❌ ${msg}`, "error");
      toast({ title: "Erro", description: "Nenhum lead encontrado nas fontes disponíveis. Tente outro nicho/cidade.", variant: "destructive" });
    }

    setCapturing(false);
  }

  function randomCidade(sigla: string): string {
    const cidades: Record<string, string[]> = {
      SP: ["São Paulo", "Campinas", "Santos", "Ribeirão Preto"],
      RJ: ["Rio de Janeiro", "Niterói", "Petrópolis"],
      MG: ["Belo Horizonte", "Uberlândia", "Contagem"],
      BA: ["Salvador", "Feira de Santana"],
      CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte"],
      RS: ["Porto Alegre", "Caxias do Sul"],
      PR: ["Curitiba", "Londrina", "Maringá"],
      PE: ["Recife", "Caruaru"],
      GO: ["Goiânia", "Anápolis"],
      AM: ["Manaus"],
    };
    const lista = cidades[sigla] ?? ["Capital"];
    return lista[Math.floor(Math.random() * lista.length)];
  }

  function getLogColor(type: LogEntry["type"]) {
    switch (type) {
      case "success": return "text-emerald-400";
      case "warn": return "text-yellow-400";
      case "error": return "text-red-400";
      default: return "text-blue-300";
    }
  }

  const estadoOpts = ESTADOS.map((e) => `${e.sigla} - ${e.nome}`);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-[hsl(220_26%_9%)] shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground">Dashboard — Captura de Leads</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Online</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {/* CAPTURE + LOGS SIDE BY SIDE */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* CAPTURE CONFIG — 70% */}
          <div className="lg:w-[70%] rounded-xl border border-border bg-card card-glow-blue overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
              <Zap className="h-4 w-4 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground text-sm">Configurar Captura</h2>
                <p className="text-xs text-muted-foreground">Defina os parâmetros de busca para capturar leads</p>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nicho / Palavra-chave</label>
                  <CategorizedNichoDropdown value={nicho} onChange={setNicho} placeholder="Ex: Dentista, Pet Shop..." />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</label>
                  <SearchableDropdown
                    options={estadoOpts}
                    value={estadoSigla ? `${estadoSigla} - ${estadoNome}` : ""}
                    onChange={(v) => { setEstadoSigla(v.split(" - ")[0]); setCidade(""); }}
                    placeholder="Selecione o estado..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cidade</label>
                  {estadoSigla && !sortear ? (
                    <SearchableDropdown options={CIDADES_POR_ESTADO[estadoSigla] ?? []} value={cidade} onChange={setCidade} placeholder={`Selecione a cidade em ${estadoNome}...`} />
                  ) : (
                    <input type="text" value={sortear ? "Será sorteada automaticamente" : ""} disabled
                      placeholder={sortear ? "Será sorteada automaticamente" : "Selecione o estado primeiro..."}
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors disabled:opacity-50" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantidade</label>
                  <div className="relative">
                    <select value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))}
                      className="w-full appearance-none px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors pr-8">
                      {QUANTIDADES.map((q) => (<option key={q} value={q}>{q} leads</option>))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modo de Captura</label>
                  <div className="relative">
                    <select value={modo} onChange={(e) => setModo(e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors pr-8">
                      {MODOS.map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide opacity-0 select-none">Ações</label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div onClick={() => setSortear(!sortear)}
                      className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${sortear ? "bg-[hsl(var(--hunter-blue))] border-[hsl(var(--hunter-blue))]" : "border-[hsl(var(--hunter-border))] bg-[hsl(var(--hunter-card-bg))]"}`}>
                      {sortear && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                      Sortear localizações
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button onClick={capturing ? undefined : handleCapture} disabled={capturing}
                  className={`relative flex items-center gap-3 px-10 py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 select-none ${capturing ? "bg-[hsl(var(--hunter-orange-glow))] cursor-not-allowed opacity-80" : "bg-[hsl(var(--hunter-orange))] hover:bg-[hsl(var(--hunter-orange-glow))] hover:scale-105 active:scale-95 card-glow-orange btn-capture-active"}`}>
                  {capturing ? (<><Loader2 className="h-5 w-5 animate-spin" />Capturando leads...</>) : (<><Play className="h-5 w-5 fill-white" />Iniciar Captura</>)}
                </button>
              </div>
            </div>
          </div>

          {/* LOGS — 30% */}
          <div className="lg:w-[30%] rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(var(--hunter-border))]">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--hunter-blue))]" />
              <div>
                <h2 className="font-semibold text-foreground text-sm">Feed de Logs</h2>
                <p className="text-xs text-muted-foreground">Acompanhe o progresso da captura em tempo real</p>
              </div>
            </div>
            <div className="flex-1 min-h-[300px] lg:min-h-0 overflow-y-auto bg-[hsl(220_26%_7%)] p-4 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-[hsl(var(--hunter-card-bg))] flex items-center justify-center">
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Nenhum log ainda</p>
                  <p className="text-muted-foreground/60 text-[11px]">Inicie uma captura para ver os logs</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className="log-entry flex gap-2 items-start">
                      <span className="text-muted-foreground/60 shrink-0">[{log.timestamp}]</span>
                      <span className={getLogColor(log.type)}>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-5 w-5" />} label="Total de Leads" value={loadingStats ? "..." : stats.total.toLocaleString("pt-BR")} color="blue" />
          <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Com WhatsApp" value={loadingStats ? "..." : stats.comWhatsApp.toLocaleString("pt-BR")} color="green" />
          <StatCard icon={<Globe className="h-5 w-5" />} label="Sem Site" value={loadingStats ? "..." : stats.semSite.toLocaleString("pt-BR")} color="orange" />
          <StatCard icon={<Calendar className="h-5 w-5" />} label="Capturados Hoje" value={loadingStats ? "..." : stats.hoje.toLocaleString("pt-BR")} color="purple" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "blue" | "green" | "orange" | "purple" }) {
  const colors = {
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", icon: "bg-blue-500/20 text-blue-400" },
    green: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "bg-emerald-500/20 text-emerald-400" },
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", icon: "bg-orange-500/20 text-orange-400" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", icon: "bg-purple-500/20 text-purple-400" },
  };
  const c = colors[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex items-start gap-3`}>
      <div className={`h-9 w-9 rounded-lg ${c.icon} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-2xl font-bold ${c.text} mt-0.5 leading-tight`}>{value}</p>
      </div>
    </div>
  );
}
