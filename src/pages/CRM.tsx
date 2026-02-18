import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Mail, GripVertical, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Lead = {
  id: string;
  nome_empresa: string;
  nicho: string;
  cidade: string;
  estado: string;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  temperatura: string;
  status_funil: string;
};

const COLUNAS: { id: string; label: string; color: string; border: string; bg: string }[] = [
  { id: "Novo",       label: "Novo",        color: "text-slate-300",  border: "border-slate-500/30",  bg: "bg-slate-500/10" },
  { id: "Contato",    label: "Contato",     color: "text-sky-300",    border: "border-sky-500/30",    bg: "bg-sky-500/10" },
  { id: "Negociando", label: "Negociando",  color: "text-purple-300", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  { id: "Proposta",   label: "Proposta",    color: "text-amber-300",  border: "border-amber-500/30",  bg: "bg-amber-500/10" },
  { id: "Ganho",      label: "Ganho",       color: "text-emerald-300",border: "border-emerald-500/30",bg: "bg-emerald-500/10" },
  { id: "Perdido",    label: "Perdido",     color: "text-red-300",    border: "border-red-500/30",    bg: "bg-red-500/10" },
];

function getTempEmoji(t: string) {
  switch (t) {
    case "Fervendo": return "🔥";
    case "Quente":   return "♨️";
    case "Morno":    return "🌡️";
    case "Frio":     return "❄️";
    default:         return "💤";
  }
}

function KanbanCard({
  lead,
  onDragStart,
}: {
  lead: Lead;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, lead.id)}
      className="group rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm p-3.5 cursor-grab active:cursor-grabbing
        hover:border-purple-500/40 hover:bg-purple-500/5 transition-all duration-150 hover:shadow-lg hover:shadow-purple-900/10 select-none"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-slate-600 shrink-0 mt-0.5 group-hover:text-slate-400 transition-colors" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-semibold text-white truncate leading-tight">{lead.nome_empresa}</span>
            <span className="shrink-0 text-xs">{getTempEmoji(lead.temperatura)}</span>
          </div>
          <p className="text-xs text-slate-500 truncate mb-2">{lead.nicho} · {lead.cidade}/{lead.estado}</p>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {lead.whatsapp && (
              <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="p-1.5 rounded-lg bg-green-600/15 hover:bg-green-600/30 text-green-400 transition-colors" title="WhatsApp">
                <MessageCircle className="h-3 w-3" />
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`}
                className="p-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 transition-colors" title="Email">
                <Mail className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  coluna,
  leads,
  onDrop,
  onDragOver,
  onDragStart,
}: {
  coluna: typeof COLUNAS[0];
  leads: Lead[];
  onDrop: (e: React.DragEvent, status: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border min-w-[240px] w-full transition-colors duration-150",
        coluna.border,
        coluna.bg,
        isDragOver && "ring-2 ring-purple-500/40 bg-purple-500/10"
      )}
      onDragOver={e => { onDragOver(e); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => { onDrop(e, coluna.id); setIsDragOver(false); }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <h3 className={cn("text-sm font-bold", coluna.color)}>{coluna.label}</h3>
        </div>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", coluna.color, coluna.border, coluna.bg)}>
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-240px)]">
        {leads.length === 0 ? (
          <div className="h-20 flex items-center justify-center rounded-lg border border-dashed border-white/10">
            <p className="text-xs text-slate-600">Arraste leads aqui</p>
          </div>
        ) : (
          leads.map(lead => (
            <KanbanCard key={lead.id} lead={lead} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  );
}

export default function CRMPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const dragId = useRef<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("id, nome_empresa, nicho, cidade, estado, whatsapp, email, site, temperatura, status_funil")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const id = dragId.current;
    if (!id) return;
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status_funil === targetStatus) return;

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status_funil: targetStatus } : l));
    await supabase.from("leads").update({ status_funil: targetStatus }).eq("id", id);
    dragId.current = null;
  };

  const byStatus = (status: string) => leads.filter(l => l.status_funil === status);

  const totalGanho = leads.filter(l => l.status_funil === "Ganho").length;
  const totalPerdido = leads.filter(l => l.status_funil === "Perdido").length;
  const taxa = leads.length > 0 ? Math.round((totalGanho / leads.length) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0f172a] shrink-0">
        <SidebarTrigger className="text-slate-400 hover:text-white" />
        <div className="h-5 w-px bg-white/10" />
        <div>
          <h1 className="text-sm font-semibold text-white">CRM — Funil de Vendas</h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {leads.length} leads
            </span>
            <span className="text-emerald-400 font-semibold">{totalGanho} ganhos</span>
            <span className="text-red-400">{totalPerdido} perdidos</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
              {taxa}% conversão
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Carregando funil...</p>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white">Funil de Vendas</h2>
              <p className="text-sm text-slate-400 mt-1">Arraste os cards entre colunas para atualizar o status</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {COLUNAS.map(col => (
                <KanbanColumn
                  key={col.id}
                  coluna={col}
                  leads={byStatus(col.id)}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
