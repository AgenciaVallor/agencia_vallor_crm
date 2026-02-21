import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Mail, GripVertical, Loader2, Users, ChevronDown, Flame } from "lucide-react";
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
  endereco: string | null;
  instagram: string | null;
  linkedin: string | null;
  observacoes: string | null;
};

const COLUNAS: { id: string; label: string; emoji: string; color: string; border: string; bg: string }[] = [
  { id: "Novo",       label: "Novo",        emoji: "📥", color: "text-slate-300",  border: "border-slate-500/30",  bg: "bg-slate-500/10" },
  { id: "Contato",    label: "Contato",     emoji: "📞", color: "text-sky-300",    border: "border-sky-500/30",    bg: "bg-sky-500/10" },
  { id: "Negociando", label: "Negociando",  emoji: "💬", color: "text-purple-300", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  { id: "Proposta",   label: "Proposta",    emoji: "📄", color: "text-amber-300",  border: "border-amber-500/30",  bg: "bg-amber-500/10" },
  { id: "Ganho",      label: "Ganho",       emoji: "✅", color: "text-emerald-300",border: "border-emerald-500/30",bg: "bg-emerald-500/10" },
  { id: "Perdido",    label: "Perdido",     emoji: "❌", color: "text-red-300",    border: "border-red-500/30",    bg: "bg-red-500/10" },
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

function KanbanCard({ lead, onDragStart }: { lead: Lead; onDragStart: (e: React.DragEvent, id: string) => void }) {
  return (
    <div draggable onDragStart={e => onDragStart(e, lead.id)}
      className="group rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm p-3.5 cursor-grab active:cursor-grabbing hover:border-purple-500/40 hover:bg-purple-500/5 transition-all duration-150 hover:shadow-lg hover:shadow-purple-900/10 select-none">
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
              <a href={`mailto:${lead.email}`} className="p-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 transition-colors" title="Email">
                <Mail className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ coluna, leads, onDrop, onDragOver, onDragStart }: {
  coluna: typeof COLUNAS[0]; leads: Lead[];
  onDrop: (e: React.DragEvent, status: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div className={cn("flex flex-col rounded-2xl border min-w-[240px] w-full transition-colors duration-150", coluna.border, coluna.bg, isDragOver && "ring-2 ring-purple-500/40 bg-purple-500/10")}
      onDragOver={e => { onDragOver(e); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => { onDrop(e, coluna.id); setIsDragOver(false); }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{coluna.emoji}</span>
          <h3 className={cn("text-sm font-bold", coluna.color)}>{coluna.label}</h3>
        </div>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", coluna.color, coluna.border, coluna.bg)}>
          {leads.length}
        </span>
      </div>
      <div className="flex-1 p-3 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-300px)]">
        {leads.length === 0 ? (
          <div className="h-20 flex items-center justify-center rounded-lg border border-dashed border-white/10">
            <p className="text-xs text-slate-600">Arraste leads aqui</p>
          </div>
        ) : leads.map(lead => <KanbanCard key={lead.id} lead={lead} onDragStart={onDragStart} />)}
      </div>
    </div>
  );
}

export default function CRMPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTemp, setFilterTemp] = useState("Todos");
  const [filterNicho, setFilterNicho] = useState("");
  const [nichosFromLeads, setNichosFromLeads] = useState<string[]>([]);
  const [nichoOpen, setNichoOpen] = useState(false);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("leads").select("nicho").eq("user_id", user.id).then(({ data }) => {
      if (data) setNichosFromLeads([...new Set(data.map(d => d.nicho))].filter(Boolean).sort());
    });
  }, [user]);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("leads")
      .select("id, nome_empresa, nicho, cidade, estado, whatsapp, email, site, temperatura, status_funil")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(500);
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleDragStart = (e: React.DragEvent, id: string) => { dragId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const id = dragId.current;
    if (!id) return;
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status_funil === targetStatus) return;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status_funil: targetStatus } : l));
    await supabase.from("leads").update({ status_funil: targetStatus }).eq("id", id);
    dragId.current = null;
  };

  // Apply filters
  const filteredLeads = leads.filter(l => {
    if (filterTemp !== "Todos" && l.temperatura !== filterTemp) return false;
    if (filterNicho && l.nicho !== filterNicho) return false;
    return true;
  });

  const byStatus = (status: string) => filteredLeads.filter(l => l.status_funil === status);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">CRM Kanban</h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {filteredLeads.length} leads</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm">Carregando funil...</p>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-foreground">CRM Kanban</h2>
              <p className="text-sm text-muted-foreground mt-1">Arraste os leads entre as colunas para gerenciar seu funil</p>
            </div>

            {/* Counters */}
            <div className="flex flex-wrap gap-3 mb-4">
              {COLUNAS.map(col => {
                const count = byStatus(col.id).length;
                return (
                  <div key={col.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", col.border, col.bg)}>
                    <span className="text-sm">{col.emoji}</span>
                    <span className={cn("text-xs font-bold", col.color)}>{col.label}: {count}</span>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setFilterTemp(filterTemp === "Fervendo" ? "Todos" : "Fervendo")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  filterTemp === "Fervendo" ? "bg-orange-600/20 border-orange-500/40 text-orange-300" : "bg-secondary border-border text-muted-foreground")}>
                <Flame className="h-3 w-3" /> Quentes
              </button>

              <div className="relative">
                <button onClick={() => setNichoOpen(!nichoOpen)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    filterNicho ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : "bg-secondary border-border text-muted-foreground")}>
                  Nicho{filterNicho ? `: ${filterNicho}` : ""} <ChevronDown className="h-3 w-3" />
                </button>
                {nichoOpen && (
                  <div className="absolute top-full mt-1 left-0 z-30 bg-card border border-border rounded-xl shadow-xl min-w-[180px] max-h-60 overflow-y-auto">
                    <button onClick={() => { setFilterNicho(""); setNichoOpen(false); }}
                      className={cn("w-full text-left px-3 py-2 text-xs", !filterNicho ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary")}>Todos</button>
                    {nichosFromLeads.map(n => (
                      <button key={n} onClick={() => { setFilterNicho(n); setNichoOpen(false); }}
                        className={cn("w-full text-left px-3 py-2 text-xs", filterNicho === n ? "bg-primary/20 text-primary" : "text-foreground hover:bg-secondary")}>{n}</button>
                    ))}
                  </div>
                )}
              </div>

              {(filterTemp !== "Todos" || filterNicho) && (
                <button onClick={() => { setFilterTemp("Todos"); setFilterNicho(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-2">✕ Limpar</button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {COLUNAS.map(col => (
                <KanbanColumn key={col.id} coluna={col} leads={byStatus(col.id)} onDrop={handleDrop} onDragOver={handleDragOver} onDragStart={handleDragStart} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
