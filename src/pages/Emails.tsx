import { useState, useEffect, useCallback } from "react";
import { Mail, MessageCircle, Clock, CheckCircle2, Reply, Loader2, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type CampaignMessage = {
  id: string;
  campaign_id: string;
  lead_id: string;
  mensagem: string;
  status: string;
  enviado_em: string | null;
  respondido_em: string | null;
  resposta: string | null;
  pausado_por_humano: boolean;
  created_at: string;
  lead?: { nome_empresa: string; nicho: string; whatsapp: string | null; email: string | null };
  campaign?: { nome: string };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pendente:   { label: "Pendente",   color: "text-yellow-400",  bg: "bg-yellow-500/15 border-yellow-500/30", icon: Clock },
  enviado:    { label: "Enviado",    color: "text-sky-400",     bg: "bg-sky-500/15 border-sky-500/30",      icon: Mail },
  respondido: { label: "Respondido", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2 },
  erro:       { label: "Erro",       color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",      icon: Mail },
};

const STATUS_LIST = ["Todos", "pendente", "enviado", "respondido"];

function MessageCard({ msg }: { msg: CampaignMessage }) {
  const cfg = STATUS_CONFIG[msg.status] || STATUS_CONFIG["pendente"];
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm p-4 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 p-2 rounded-lg border", cfg.bg)}>
          <Icon className={cn("h-4 w-4", cfg.color)} />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white truncate">{msg.lead?.nome_empresa ?? "Lead desconhecido"}</p>
              <p className="text-xs text-slate-500 truncate">{msg.lead?.nicho} · Campanha: {msg.campaign?.nome ?? "—"}</p>
            </div>
            <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border", cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
          </div>

          {/* Mensagem enviada */}
          <div className="rounded-lg bg-black/20 border border-white/5 p-3 text-xs text-slate-300 leading-relaxed line-clamp-3">
            {msg.mensagem}
          </div>

          {/* Resposta recebida */}
          {msg.resposta && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-200 leading-relaxed">
              <p className="text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                <Reply className="h-3 w-3" /> Resposta recebida
              </p>
              {msg.resposta}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {msg.enviado_em && (
                <span>Enviado: {format(new Date(msg.enviado_em), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              )}
              {msg.respondido_em && (
                <span className="text-emerald-500">Respondido: {format(new Date(msg.respondido_em), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              {msg.lead?.whatsapp && (
                <a
                  href={`https://wa.me/${msg.lead.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600/15 hover:bg-green-600/30 text-green-400 text-xs transition-colors"
                  title="Retomar via WhatsApp"
                >
                  <MessageCircle className="h-3 w-3" /> Retomar
                </a>
              )}
              {msg.lead?.email && (
                <a
                  href={`mailto:${msg.lead.email}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 text-xs transition-colors"
                  title="Retomar via Email"
                >
                  <Mail className="h-3 w-3" /> Email
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailsPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("campaign_messages")
      .select(`
        *,
        lead:leads(nome_empresa, nicho, whatsapp, email),
        campaign:campaigns(nome)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterStatus !== "Todos") query = query.eq("status", filterStatus);

    const { data } = await query;
    if (data) setMessages(data as CampaignMessage[]);
    setLoading(false);
  }, [user, filterStatus]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const filtered = search
    ? messages.filter(m =>
        m.lead?.nome_empresa?.toLowerCase().includes(search.toLowerCase()) ||
        m.mensagem?.toLowerCase().includes(search.toLowerCase())
      )
    : messages;

  const counts = {
    total: messages.length,
    enviado: messages.filter(m => m.status === "enviado").length,
    respondido: messages.filter(m => m.status === "respondido").length,
    pendente: messages.filter(m => m.status === "pendente").length,
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a]">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0f172a] shrink-0">
        <SidebarTrigger className="text-slate-400 hover:text-white" />
        <div className="h-5 w-px bg-white/10" />
        <h1 className="text-sm font-semibold text-white">Histórico de Mensagens</h1>
        {loading && <Loader2 className="h-4 w-4 text-purple-400 animate-spin ml-2" />}
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          <span>{counts.total} msgs</span>
          <span className="text-sky-400">{counts.enviado} enviadas</span>
          <span className="text-emerald-400">{counts.respondido} respondidas</span>
          <span className="text-yellow-400">{counts.pendente} pendentes</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Histórico de Mensagens</h2>
          <p className="text-sm text-slate-400 mt-1">Todas as mensagens enviadas pelas suas campanhas</p>
        </div>

        {/* Search + Status filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por empresa ou mensagem..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500
                focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            {STATUS_LIST.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterStatus === s ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                )}>
                {s === "Todos" ? "Todos" : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Messages list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Carregando mensagens...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Mail className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-white font-medium">Nenhuma mensagem encontrada</p>
            <p className="text-slate-500 text-sm">Ative uma campanha para começar a enviar mensagens</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(msg => (
              <MessageCard key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
