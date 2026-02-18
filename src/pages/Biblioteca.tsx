import { useState, useEffect, useCallback } from "react";
import {
  Search, Upload, Download, Copy, Trash2, Globe, GlobeLock,
  MessageCircle, Mail, Edit2, ExternalLink, ChevronDown, X, Building2,
  User, MapPin, Phone, Bot, Filter, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NICHOS } from "@/data/nichos";
import { cn } from "@/lib/utils";

type Lead = {
  id: string;
  nome_empresa: string;
  nicho: string;
  cidade: string;
  estado: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  temperatura: string;
  status_funil: string;
  fonte: string;
  created_at: string;
};

const TEMPERATURAS = ["Todos", "Fervendo", "Quente", "Morno", "Frio", "Desinteressado"];
const STATUS_FUNIL = ["Todos", "Novo", "Contato", "Negociando", "Proposta", "Ganho", "Perdido"];

function getTemperaturaStyle(t: string) {
  switch (t) {
    case "Fervendo": return { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", emoji: "🔥" };
    case "Quente":   return { color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30", emoji: "♨️" };
    case "Morno":    return { color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", emoji: "🌡️" };
    case "Frio":     return { color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", emoji: "❄️" };
    default:         return { color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30", emoji: "💤" };
  }
}

function getStatusStyle(s: string) {
  switch (s) {
    case "Ganho":      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Perdido":    return "bg-red-500/15 text-red-400 border-red-500/30";
    case "Negociando": return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "Proposta":   return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Contato":    return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    default:           return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

// Modal de detalhes do lead
function LeadModal({ lead, onClose, onDelete }: { lead: Lead; onClose: () => void; onDelete: (id: string) => void }) {
  const temp = getTemperaturaStyle(lead.temperatura);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-purple-500/20 bg-[#0f172a] shadow-2xl shadow-purple-900/30 p-6 space-y-4 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div>
          <h2 className="text-xl font-bold text-white">{lead.nome_empresa}</h2>
          <p className="text-sm text-slate-400">{lead.nicho}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", temp.bg, temp.color)}>
            {temp.emoji} {lead.temperatura}
          </span>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", getStatusStyle(lead.status_funil))}>
            {lead.status_funil}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="h-4 w-4 text-purple-400 shrink-0" />
            {lead.cidade}, {lead.estado}
          </div>
          {lead.whatsapp && (
            <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors">
              <MessageCircle className="h-4 w-4 shrink-0" />
              {lead.whatsapp}
            </a>
          )}
          {lead.telefone && (
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="h-4 w-4 shrink-0 text-slate-500" />
              {lead.telefone}
            </div>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
              <Mail className="h-4 w-4 shrink-0" />
              {lead.email}
            </a>
          )}
          {lead.site && (
            <a href={lead.site.startsWith("http") ? lead.site : `https://${lead.site}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
              <Globe className="h-4 w-4 shrink-0" />
              {lead.site}
            </a>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {lead.whatsapp && (
            <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              <Mail className="h-4 w-4" /> Email
            </a>
          )}
          <button onClick={() => { onDelete(lead.id); onClose(); }}
            className="px-3 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-medium transition-colors border border-red-500/30">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Card individual de lead
function LeadCard({ lead, onClick, onDelete }: { lead: Lead; onClick: () => void; onDelete: (id: string) => void }) {
  const temp = getTemperaturaStyle(lead.temperatura);

  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm p-4 cursor-pointer
        hover:border-purple-500/40 hover:bg-purple-500/5 transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm leading-tight truncate">{lead.nome_empresa}</h3>
          <p className="text-xs text-slate-400 truncate mt-0.5">{lead.nicho}</p>
        </div>
        <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border", temp.bg, temp.color)}>
          {temp.emoji}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
          <Building2 className="h-2.5 w-2.5 inline mr-1" />Empresa
        </span>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", getStatusStyle(lead.status_funil))}>
          {lead.status_funil}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
          <span className="truncate">{lead.cidade}, {lead.estado}</span>
        </div>
        {lead.whatsapp && (
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-3 w-3 text-green-500 shrink-0" />
            <span className="truncate text-green-400">{lead.whatsapp}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-blue-500 shrink-0" />
            <span className="truncate text-blue-400">{lead.email}</span>
          </div>
        )}
        {lead.site && (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-purple-400 shrink-0" />
            <span className="truncate text-purple-300">{lead.site}</span>
          </div>
        )}
      </div>

      {/* Action icons (show on hover) */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1"
        onClick={e => e.stopPropagation()}>
        {lead.whatsapp && (
          <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
            className="p-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-colors"
            title="Abrir WhatsApp">
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`}
            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 transition-colors"
            title="Enviar Email">
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        <button onClick={() => onDelete(lead.id)}
          className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
          title="Excluir lead">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function BibliotecaPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterNicho, setFilterNicho] = useState("");
  const [filterWhatsApp, setFilterWhatsApp] = useState(false);
  const [filterEmail, setFilterEmail] = useState(false);
  const [filterSemSite, setFilterSemSite] = useState(false);
  const [filterComSite, setFilterComSite] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [nichoOpen, setNichoOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (filterTemp !== "Todos") query = query.eq("temperatura", filterTemp);
    if (filterStatus !== "Todos") query = query.eq("status_funil", filterStatus);
    if (filterNicho) query = query.eq("nicho", filterNicho);
    if (filterWhatsApp) query = query.not("whatsapp", "is", null);
    if (filterEmail) query = query.not("email", "is", null);
    if (filterSemSite) query = query.is("site", null);
    if (filterComSite) query = query.not("site", "is", null);
    if (search) query = query.or(`nome_empresa.ilike.%${search}%,nicho.ilike.%${search}%,cidade.ilike.%${search}%`);

    const { data, error } = await query.limit(500);
    if (!error && data) setLeads(data as Lead[]);
    setLoading(false);
  }, [user, filterTemp, filterStatus, filterNicho, filterWhatsApp, filterEmail, filterSemSite, filterComSite, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleDelete = async (id: string) => {
    await supabase.from("leads").delete().eq("id", id);
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await supabase.from("leads").delete().in("id", ids);
    setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set());
  };

  const exportCSV = () => {
    const headers = ["Nome", "Nicho", "Cidade", "Estado", "WhatsApp", "Email", "Site", "Temperatura", "Status"];
    const rows = leads.map(l => [
      l.nome_empresa, l.nicho, l.cidade, l.estado,
      l.whatsapp ?? "", l.email ?? "", l.site ?? "", l.temperatura, l.status_funil
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads_vallor.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const removeDuplicates = async () => {
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    leads.forEach(l => {
      const key = l.nome_empresa.toLowerCase().trim() + l.cidade.toLowerCase();
      if (seen.has(key)) toDelete.push(l.id);
      else seen.set(key, l.id);
    });
    if (toDelete.length === 0) return;
    await supabase.from("leads").delete().in("id", toDelete);
    setLeads(prev => prev.filter(l => !toDelete.includes(l.id)));
  };

  const clearFilters = () => {
    setSearch(""); setFilterTemp("Todos"); setFilterStatus("Todos"); setFilterNicho("");
    setFilterWhatsApp(false); setFilterEmail(false); setFilterSemSite(false); setFilterComSite(false);
  };

  const hasFilters = search || filterTemp !== "Todos" || filterStatus !== "Todos" || filterNicho ||
    filterWhatsApp || filterEmail || filterSemSite || filterComSite;

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-white/5 bg-[#0f172a] shrink-0">
        <SidebarTrigger className="text-slate-400 hover:text-white" />
        <div className="h-5 w-px bg-white/10" />
        <div>
          <h1 className="text-sm font-semibold text-white leading-tight">Biblioteca de Leads</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium border border-red-500/30 transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Excluir {selectedIds.size}
            </button>
          )}
          <button onClick={removeDuplicates}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors">
            <Copy className="h-3.5 w-3.5" /> Duplicatas
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition-colors">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors">
            <Upload className="h-3.5 w-3.5" /> Importar
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4">

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-white">Biblioteca de Leads Capturados</h2>
            <p className="text-sm text-slate-400 mt-1">Gerencie todos os seus leads capturados</p>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, nicho ou cidade..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500
                focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Temperatura filter */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              {TEMPERATURAS.map(t => (
                <button key={t} onClick={() => setFilterTemp(t)}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    filterTemp === t
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white"
                  )}>
                  {t === "Fervendo" && "🔥 "}{t === "Quente" && "♨️ "}{t === "Morno" && "🌡️ "}{t === "Frio" && "❄️ "}{t}
                </button>
              ))}
            </div>

            {/* Status funil */}
            <div className="relative">
              <button onClick={() => setNichoOpen(!nichoOpen)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  filterStatus !== "Todos"
                    ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                    : "bg-white/5 border-white/10 text-slate-300 hover:border-white/20"
                )}>
                Funil: {filterStatus} <ChevronDown className="h-3 w-3" />
              </button>
              {nichoOpen && (
                <div className="absolute top-full mt-1 left-0 z-30 bg-[#0f172a] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                  {STATUS_FUNIL.map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setNichoOpen(false); }}
                      className={cn("w-full text-left px-3 py-2 text-xs transition-colors",
                        filterStatus === s ? "bg-purple-600/20 text-purple-300" : "text-slate-300 hover:bg-white/5"
                      )}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle filters */}
            {[
              { label: "WhatsApp", icon: MessageCircle, color: "green", key: "whatsapp", active: filterWhatsApp, set: setFilterWhatsApp },
              { label: "Email", icon: Mail, color: "blue", key: "email", active: filterEmail, set: setFilterEmail },
              { label: "Sem Site", icon: GlobeLock, color: "slate", key: "semsite", active: filterSemSite, set: setFilterSemSite },
              { label: "Com Site", icon: Globe, color: "purple", key: "comsite", active: filterComSite, set: setFilterComSite },
            ].map(({ label, icon: Icon, color, key, active, set }) => (
              <button key={key} onClick={() => set(!active)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  active
                    ? `bg-${color}-600/20 border-${color}-500/40 text-${color}-300`
                    : "bg-white/5 border-white/10 text-slate-300 hover:border-white/20"
                )}>
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}

            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white transition-colors">
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>

          {/* Count */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-purple-400">{leads.length}</span>
            <span className="text-slate-400 text-sm">leads encontrados</span>
            {loading && <Loader2 className="h-4 w-4 text-slate-500 animate-spin ml-1" />}
          </div>

          {/* Grid of cards */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto" />
                <p className="text-slate-400 text-sm">Carregando leads...</p>
              </div>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Search className="h-7 w-7 text-slate-500" />
              </div>
              <p className="text-white font-medium">Nenhum lead encontrado</p>
              <p className="text-slate-500 text-sm">
                {hasFilters ? "Tente remover alguns filtros" : "Capture leads no Dashboard para começar"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {leads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => setSelectedLead(lead)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
