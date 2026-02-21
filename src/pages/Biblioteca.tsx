import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Upload, Download, Copy, Trash2, Globe, GlobeLock,
  MessageCircle, Mail, ExternalLink, ChevronDown, X, Building2,
  MapPin, Phone, Loader2, Edit2, Save,
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
  endereco: string | null;
  instagram: string | null;
  linkedin: string | null;
  observacoes: string | null;
};

const TEMPERATURAS = ["Todos", "Fervendo", "Quente", "Morno", "Frio", "Desinteressado"];
const STATUS_FUNIL = ["Todos", "Novo", "Contato", "Negociando", "Proposta", "Ganho", "Perdido"];
const PAGE_SIZE = 50;

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

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (updated: Lead) => void }) {
  const [form, setForm] = useState<Lead>({ ...lead });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("leads")
      .update({
        nome_empresa: form.nome_empresa,
        nicho: form.nicho,
        whatsapp: form.whatsapp,
        telefone: form.telefone,
        email: form.email,
        site: form.site,
        temperatura: form.temperatura,
        status_funil: form.status_funil,
        cidade: form.cidade,
        estado: form.estado,
        instagram: form.instagram,
        linkedin: form.linkedin,
        endereco: form.endereco,
        observacoes: form.observacoes,
      })
      .eq("id", lead.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) onSave(data as Lead);
  };

  const field = (
    label: string,
    key: keyof Lead,
    opts?: { type?: string; options?: string[] }
  ) => (
    <div className="space-y-1">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {opts?.options ? (
        <select
          value={String(form[key] ?? "")}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm
            focus:outline-none focus:border-purple-500/50 transition-all"
        >
          {opts.options.map(o => <option key={o} value={o} className="bg-[#0f172a]">{o}</option>)}
        </select>
      ) : (
        <input
          type={opts?.type ?? "text"}
          value={String(form[key] ?? "")}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm
            focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-600"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-purple-500/20 bg-[#0f172a] shadow-2xl shadow-purple-900/30 p-6 space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-purple-400" /> Editar Lead
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Edite os dados e clique em Salvar</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("Nome da Empresa", "nome_empresa")}
          {field("Nicho", "nicho", { options: NICHOS })}
          {field("WhatsApp", "whatsapp")}
          {field("Telefone", "telefone")}
          {field("Email", "email", { type: "email" })}
          {field("Site", "site")}
          {field("Cidade", "cidade")}
          {field("Estado", "estado")}
          {field("Temperatura", "temperatura", { options: ["Fervendo", "Quente", "Morno", "Frio", "Desinteressado"] })}
          {field("Status Funil", "status_funil", { options: ["Novo", "Contato", "Negociando", "Proposta", "Ganho", "Perdido"] })}
          {field("Instagram", "instagram")}
          {field("LinkedIn", "linkedin")}
          {field("Endereço", "endereco")}
        </div>
        <div className="space-y-1 mt-3">
          <label className="text-xs text-slate-400 font-medium">Observações</label>
          <textarea
            value={String(form.observacoes ?? "")}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm
              focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-600 resize-none"
            placeholder="Notas sobre este lead..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onDelete, onEdit }: {
  lead: Lead; onClose: () => void; onDelete: (id: string) => void; onEdit: () => void;
}) {
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
              <MessageCircle className="h-4 w-4 shrink-0" />{lead.whatsapp}
            </a>
          )}
          {lead.telefone && (
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="h-4 w-4 shrink-0 text-slate-500" />{lead.telefone}
            </div>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
              <Mail className="h-4 w-4 shrink-0" />{lead.email}
            </a>
          )}
          {lead.site && (
            <a href={lead.site.startsWith("http") ? lead.site : `https://${lead.site}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors">
              <Globe className="h-4 w-4 shrink-0" />{lead.site}
            </a>
          )}
          {lead.endereco && (
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="h-4 w-4 text-amber-400 shrink-0" />{lead.endereco}
            </div>
          )}
          {lead.instagram && (
            <a href={`https://instagram.com/${lead.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors">
              <ExternalLink className="h-4 w-4 shrink-0" />@{lead.instagram.replace(/^@/, '')}
            </a>
          )}
          {lead.linkedin && (
            <a href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors">
              <ExternalLink className="h-4 w-4 shrink-0" />{lead.linkedin}
            </a>
          )}
          {lead.observacoes && (
            <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
              {lead.observacoes}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onEdit}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-sm font-medium transition-colors border border-purple-500/30">
            <Edit2 className="h-4 w-4" /> Editar
          </button>
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

// ─── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({ lead, onClick, onDelete, onEdit }: {
  lead: Lead; onClick: () => void; onDelete: (id: string) => void; onEdit: (lead: Lead) => void;
}) {
  const temp = getTemperaturaStyle(lead.temperatura);

  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm p-4 cursor-pointer
        hover:border-purple-500/40 hover:bg-purple-500/5 transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/20"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm leading-tight truncate">{lead.nome_empresa}</h3>
          <p className="text-xs text-slate-400 truncate mt-0.5">{lead.nicho}</p>
        </div>
        <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border", temp.bg, temp.color)}>
          {temp.emoji}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
          <Building2 className="h-2.5 w-2.5 inline mr-1" />Empresa
        </span>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", getStatusStyle(lead.status_funil))}>
          {lead.status_funil}
        </span>
      </div>

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

      {/* Hover actions */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit(lead)}
          className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 transition-colors" title="Editar">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        {lead.whatsapp && (
          <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
            className="p-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-colors" title="WhatsApp">
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`}
            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 transition-colors" title="Email">
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        <button onClick={() => onDelete(lead.id)}
          className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors" title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BibliotecaPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterNicho, setFilterNicho] = useState("");
  const [filterWhatsApp, setFilterWhatsApp] = useState(false);
  const [filterEmail, setFilterEmail] = useState(false);
  const [filterSemSite, setFilterSemSite] = useState(false);
  const [filterComSite, setFilterComSite] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [nichoOpen, setNichoOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const buildQuery = useCallback((fromIdx: number) => {
    if (!user) return null;
    let q = supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(fromIdx, fromIdx + PAGE_SIZE - 1);
    if (filterTemp !== "Todos") q = q.eq("temperatura", filterTemp);
    if (filterStatus !== "Todos") q = q.eq("status_funil", filterStatus);
    if (filterNicho) q = q.eq("nicho", filterNicho);
    if (filterWhatsApp) q = q.not("whatsapp", "is", null);
    if (filterEmail) q = q.not("email", "is", null);
    if (filterSemSite) q = q.is("site", null);
    if (filterComSite) q = q.not("site", "is", null);
    if (search) q = q.or(`nome_empresa.ilike.%${search}%,nicho.ilike.%${search}%,cidade.ilike.%${search}%`);
    return q;
  }, [user, filterTemp, filterStatus, filterNicho, filterWhatsApp, filterEmail, filterSemSite, filterComSite, search]);

  const loadInitial = useCallback(async () => {
    const q = buildQuery(0);
    if (!q) return;
    setLoading(true);
    setPage(0);
    setHasMore(true);
    const { data } = await q;
    if (data) {
      setLeads(data as Lead[]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    const q = buildQuery(nextPage * PAGE_SIZE);
    if (!q) return;
    setLoadingMore(true);
    const { data } = await q;
    if (data) {
      setLeads(prev => [...prev, ...data as Lead[]]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(nextPage);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, buildQuery]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) loadMore();
    }, { threshold: 0.1 });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadMore]);

  const handleDelete = async (id: string) => {
    await supabase.from("leads").delete().eq("id", id);
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const handleSaveEdit = (updated: Lead) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
    if (selectedLead?.id === updated.id) setSelectedLead(updated);
    setEditingLead(null);
  };

  const exportCSV = () => {
    const headers = ["Nome", "Nicho", "Cidade", "Estado", "WhatsApp", "Email", "Site", "Temperatura", "Status", "Instagram", "LinkedIn", "Endereço", "Observações"];
    const rows = leads.map(l => [
      l.nome_empresa, l.nicho, l.cidade, l.estado,
      l.whatsapp ?? "", l.email ?? "", l.site ?? "", l.temperatura, l.status_funil,
      l.instagram ?? "", l.linkedin ?? "", l.endereco ?? "", l.observacoes ?? ""
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
        <h1 className="text-sm font-semibold text-white leading-tight">Biblioteca de Leads</h1>
        <div className="ml-auto flex items-center gap-2">
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
          <div>
            <h2 className="text-2xl font-bold text-white">Biblioteca de Leads Capturados</h2>
            <p className="text-sm text-slate-400 mt-1">Gerencie todos os seus leads capturados</p>
          </div>

          {/* Search */}
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

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Temperatura */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              {TEMPERATURAS.map(t => (
                <button key={t} onClick={() => setFilterTemp(t)}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    filterTemp === t ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                  )}>
                  {t === "Fervendo" && "🔥 "}{t === "Quente" && "♨️ "}{t === "Morno" && "🌡️ "}{t === "Frio" && "❄️ "}{t}
                </button>
              ))}
            </div>

            {/* Funil dropdown */}
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
            {([
              { label: "WhatsApp", icon: MessageCircle, active: filterWhatsApp, set: setFilterWhatsApp, cls: "text-green-300 border-green-500/40 bg-green-600/20" },
              { label: "Email",    icon: Mail,          active: filterEmail,    set: setFilterEmail,    cls: "text-blue-300 border-blue-500/40 bg-blue-600/20" },
              { label: "Sem Site", icon: GlobeLock,     active: filterSemSite,  set: setFilterSemSite,  cls: "text-slate-300 border-slate-500/40 bg-slate-600/20" },
              { label: "Com Site", icon: Globe,         active: filterComSite,  set: setFilterComSite,  cls: "text-purple-300 border-purple-500/40 bg-purple-600/20" },
            ] as const).map(({ label, icon: Icon, active, set, cls }) => (
              <button key={label} onClick={() => set(!active)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  active ? cls : "bg-white/5 border-white/10 text-slate-300 hover:border-white/20"
                )}>
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}

            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white transition-colors">
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>

          {/* Count */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-purple-400">{leads.length}</span>
            <span className="text-slate-400 text-sm">leads carregados</span>
            {(loading || loadingMore) && <Loader2 className="h-4 w-4 text-slate-500 animate-spin ml-1" />}
          </div>

          {/* Grid */}
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {leads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => setSelectedLead(lead)}
                    onDelete={handleDelete}
                    onEdit={setEditingLead}
                  />
                ))}
              </div>
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                {loadingMore && <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />}
                {!hasMore && leads.length > 0 && (
                  <p className="text-xs text-slate-600">Todos os leads carregados</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedLead && !editingLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onDelete={handleDelete}
          onEdit={() => setEditingLead(selectedLead)}
        />
      )}

      {/* Edit modal */}
      {editingLead && (
        <EditModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
