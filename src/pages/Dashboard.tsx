import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Square, Users, MessageCircle, Globe, Calendar,
  Zap, TrendingUp, CheckCircle, Loader2, Shuffle, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NICHOS } from "@/data/nichos";
import { ESTADOS } from "@/data/estados";
import { generateMockLeads, getTemperaturaColor, getTemperaturaIcon } from "@/utils/mockLeads";
import { SearchableDropdown } from "@/components/SearchableDropdown";
import { SidebarTrigger } from "@/components/ui/sidebar";

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

const QUANTIDADES = [5, 10, 20, 50, 100];
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
  const [nicho, setNicho] = useState("");
  const [estadoSigla, setEstadoSigla] = useState("");
  const [cidade, setCidade] = useState("");
  const [sortear, setSortear] = useState(false);
  const [quantidade, setQuantidade] = useState(20);
  const [modo, setModo] = useState("Todos os leads");
  const [capturing, setCapturing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<StatsState>({ total: 402, comWhatsApp: 284, semSite: 150, hoje: 45 });
  const logsEndRef = useRef<HTMLDivElement>(null);

  const estadoNome = ESTADOS.find((e) => e.sigla === estadoSigla)?.nome ?? "";

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: now(), message, type },
    ]);
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function handleCapture() {
    if (!nicho || !estadoSigla || (!sortear && !cidade)) {
      addLog("⚠️ Preencha Nicho, Estado e Cidade antes de capturar.", "warn");
      return;
    }

    setCapturing(true);
    setLogs([]);

    const cidadeAlvo = sortear ? randomCidade(estadoSigla) : cidade;

    addLog(`🔍 Buscando ${nicho} em ${cidadeAlvo} - ${estadoSigla}...`, "info");
    await sleep(800);
    addLog(`🗺️ Conectando ao Google Maps simulado...`, "info");
    await sleep(600);
    addLog(`📍 Escaneando região: ${cidadeAlvo}, ${estadoSigla}`, "info");
    await sleep(700);

    const partialCount = Math.floor(quantidade * 0.4);
    addLog(`📥 Extraídos ${partialCount} leads iniciais...`, "info");
    await sleep(500);
    addLog(`🔗 Enriquecendo dados de WhatsApp...`, "info");
    await sleep(800);
    addLog(`📧 Verificando emails e sites...`, "info");
    await sleep(600);

    const leads = generateMockLeads(nicho, cidadeAlvo, estadoSigla, quantidade);

    // Apply mode filter
    let filtered = [...leads];
    if (modo === "Com WhatsApp") filtered = leads.filter((l) => l.whatsapp);
    else if (modo === "WhatsApp + Email") filtered = leads.filter((l) => l.whatsapp && l.email);
    else if (modo === "Prioriza sem site") filtered = [...leads].sort((a, b) => (a.site ? 1 : -1) - (b.site ? 1 : -1));
    else if (modo === "Prioriza com site") filtered = [...leads].sort((a, b) => (b.site ? 1 : 0) - (a.site ? 1 : 0));
    else if (modo === "Apenas com site") filtered = leads.filter((l) => l.site);

    addLog(`🌡️ Classificando temperatura dos leads...`, "info");
    await sleep(500);

    const fervendo = filtered.filter((l) => l.temperatura === "Fervendo").length;
    const quente = filtered.filter((l) => l.temperatura === "Quente").length;
    const morno = filtered.filter((l) => l.temperatura === "Morno").length;

    addLog(`🔥 Fervendo: ${fervendo} | ♨️ Quente: ${quente} | 🌡️ Morno: ${morno}`, "info");
    await sleep(400);
    addLog(`💾 Salvando ${filtered.length} leads no banco de dados...`, "info");
    await sleep(600);

    try {
      const { error } = await supabase.from("leads").insert(filtered);
      if (error) {
        addLog(`❌ Erro ao salvar: ${error.message}`, "error");
      } else {
        addLog(`✅ Captura concluída! ${filtered.length} leads salvos com sucesso.`, "success");
        setStats((prev) => ({
          total: prev.total + filtered.length,
          comWhatsApp: prev.comWhatsApp + filtered.filter((l) => l.whatsapp).length,
          semSite: prev.semSite + filtered.filter((l) => !l.site).length,
          hoje: prev.hoje + filtered.length,
        }));
      }
    } catch (err) {
      addLog(`❌ Erro inesperado ao salvar leads.`, "error");
    }

    setCapturing(false);
  }

  function randomCidade(sigla: string): string {
    const cidades: Record<string, string[]> = {
      SP: ["São Paulo", "Campinas", "Santos", "Ribeirão Preto", "São Bernardo do Campo"],
      RJ: ["Rio de Janeiro", "Niterói", "Petrópolis", "Volta Redonda"],
      MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora"],
      BA: ["Salvador", "Feira de Santana", "Vitória da Conquista"],
      CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte"],
      RS: ["Porto Alegre", "Caxias do Sul", "Pelotas"],
      PR: ["Curitiba", "Londrina", "Maringá"],
      PE: ["Recife", "Caruaru", "Olinda"],
      GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis"],
      AM: ["Manaus", "Parintins", "Tefé"],
    };
    const lista = cidades[sigla] ?? ["Capital", "Cidade A", "Cidade B"];
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
      {/* Top bar */}
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

        {/* ── CAPTURE CONFIG CARD ── */}
        <div className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] card-glow-blue overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(var(--hunter-border))]">
            <Zap className="h-4 w-4 text-[hsl(var(--hunter-orange))]" />
            <h2 className="font-semibold text-foreground text-sm">Configurar Captura</h2>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Nicho */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nicho / Palavra-chave
                </label>
                <SearchableDropdown
                  options={NICHOS}
                  value={nicho}
                  onChange={setNicho}
                  placeholder="Ex: Dentista, Pet Shop..."
                />
              </div>

              {/* Estado */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Estado
                </label>
                <SearchableDropdown
                  options={estadoOpts}
                  value={estadoSigla ? `${estadoSigla} - ${estadoNome}` : ""}
                  onChange={(v) => {
                    const sigla = v.split(" - ")[0];
                    setEstadoSigla(sigla);
                    setCidade("");
                  }}
                  placeholder="Selecione o estado..."
                />
              </div>

              {/* Cidade */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Cidade
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  disabled={sortear}
                  placeholder={estadoSigla ? `Digite a cidade em ${estadoNome}...` : "Selecione o estado primeiro..."}
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors disabled:opacity-50"
                />
              </div>

              {/* Quantidade */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Quantidade
                </label>
                <div className="relative">
                  <select
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                    className="w-full appearance-none px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors pr-8"
                  >
                    {QUANTIDADES.map((q) => (
                      <option key={q} value={q}>{q} leads</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Modo de Captura */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Modo de Captura
                </label>
                <div className="relative">
                  <select
                    value={modo}
                    onChange={(e) => setModo(e.target.value)}
                    className="w-full appearance-none px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors pr-8"
                  >
                    {MODOS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Sortear + Botão */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide opacity-0 select-none">
                  Ações
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      onClick={() => setSortear(!sortear)}
                      className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                        sortear ? "bg-[hsl(var(--hunter-blue))] border-[hsl(var(--hunter-blue))]" : "border-[hsl(var(--hunter-border))] bg-[hsl(var(--hunter-card-bg))]"
                      }`}
                    >
                      {sortear && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                      Sortear localizações
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={capturing ? undefined : handleCapture}
                disabled={capturing}
                className={`
                  relative flex items-center gap-3 px-10 py-3.5 rounded-xl font-bold text-base text-white
                  transition-all duration-200 select-none
                  ${capturing
                    ? "bg-[hsl(var(--hunter-orange-glow))] cursor-not-allowed opacity-80"
                    : "bg-[hsl(var(--hunter-orange))] hover:bg-[hsl(var(--hunter-orange-glow))] hover:scale-105 active:scale-95 card-glow-orange btn-capture-active"
                  }
                `}
              >
                {capturing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Capturando leads...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-white" />
                    Iniciar Captura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── LOGS FEED ── */}
        <div className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(var(--hunter-border))]">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--hunter-blue))]" />
              <h2 className="font-semibold text-foreground text-sm">Feed de Logs</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Acompanhe o progresso da captura em tempo real
            </span>
          </div>

          <div className="h-52 overflow-y-auto bg-[hsl(220_26%_7%)] p-4 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--hunter-card-bg))] flex items-center justify-center">
                  <Play className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Nenhum log ainda.</p>
                <p className="text-muted-foreground/60 text-[11px]">Inicie uma captura para ver o progresso...</p>
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

        {/* ── STATS CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total de Leads"
            value={stats.total.toLocaleString("pt-BR")}
            color="blue"
          />
          <StatCard
            icon={<MessageCircle className="h-5 w-5" />}
            label="Com WhatsApp"
            value={stats.comWhatsApp.toLocaleString("pt-BR")}
            color="green"
          />
          <StatCard
            icon={<Globe className="h-5 w-5" />}
            label="Sem Site"
            value={stats.semSite.toLocaleString("pt-BR")}
            color="orange"
          />
          <StatCard
            icon={<Calendar className="h-5 w-5" />}
            label="Capturados Hoje"
            value={stats.hoje.toLocaleString("pt-BR")}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "orange" | "purple";
}) {
  const colors = {
    blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400",   icon: "bg-blue-500/20 text-blue-400" },
    green:  { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "bg-emerald-500/20 text-emerald-400" },
    orange: { bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-400",  icon: "bg-orange-500/20 text-orange-400" },
    purple: { bg: "bg-purple-500/10",  border: "border-purple-500/20",  text: "text-purple-400",  icon: "bg-purple-500/20 text-purple-400" },
  };
  const c = colors[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex items-start gap-3`}>
      <div className={`h-9 w-9 rounded-lg ${c.icon} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-2xl font-bold ${c.text} mt-0.5 leading-tight`}>{value}</p>
      </div>
    </div>
  );
}
