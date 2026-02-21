import { useState, useEffect, useCallback } from "react";
import { Plus, Play, Pause, Send, MessageSquare, Users, Clock, Zap, X, ChevronRight, ChevronLeft, Trash2, Loader2, AlertTriangle, Calendar, MessageCircle, CheckCircle, XCircle, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SearchableDropdown } from "@/components/SearchableDropdown";
import { NICHOS } from "@/data/nichos";
import WhatsAppConnect from "@/components/WhatsAppConnect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  nome: string;
  nicho_filtro: string;
  cidade_filtro: string;
  estado_filtro: string;
  delay_segundos: number;
  quantidade_por_dia: number;
  status: string;
  total_enviados: number;
  total_leads: number;
  created_at: string;
}

interface CampaignMessage {
  id: string;
  campaign_id: string;
  lead_id: string;
  mensagem: string;
  status: string;
  enviado_em: string | null;
  resposta: string | null;
  pausado_por_humano: boolean;
}


const ESTADOS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
type WizardStep = 1 | 2 | 3 | 4;
type Tab = "campanhas" | "conversas" | "agenda";

interface Agendamento {
  id: string;
  data_hora: string;
  email_lead: string;
  titulo: string;
  descricao: string | null;
  status: string;
  leads?: { nome_empresa: string; nicho: string } | null;
}

function AgendaTab() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("agendamentos")
        .select("*, leads(nome_empresa, nicho)")
        .order("data_hora", { ascending: true });
      setAgendamentos((data as any) || []);
      setLoading(false);
    })();
  }, []);

  async function updateStatus(id: string, status: string) {
    await supabase.from("agendamentos").update({ status }).eq("id", id);
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }

  const statusStyle: Record<string, string> = {
    agendado: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    confirmado: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    cancelado: "text-red-400 bg-red-400/10 border-red-400/30",
    realizado: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>;

  if (agendamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-foreground font-medium">Sua agenda está vazia</p>
        <p className="text-muted-foreground text-sm">Reuniões agendadas pelo agente IA aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agendamentos.map(ag => (
        <div key={ag.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm">{ag.titulo}</h3>
              {ag.leads && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> {ag.leads.nome_empresa} — {ag.leads.nicho}
                </p>
              )}
            </div>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusStyle[ag.status] || "text-muted-foreground")}>{ag.status}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(ag.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {ag.email_lead}</span>
          </div>
          {ag.descricao && <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2">{ag.descricao}</p>}
          <div className="flex gap-2">
            {ag.status === "agendado" && (
              <>
                <button onClick={() => updateStatus(ag.id, "confirmado")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition">
                  <CheckCircle className="h-3 w-3" /> Confirmar
                </button>
                <button onClick={() => updateStatus(ag.id, "cancelado")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition">
                  <XCircle className="h-3 w-3" /> Cancelar
                </button>
              </>
            )}
            {ag.status === "confirmado" && (
              <button onClick={() => updateStatus(ag.id, "realizado")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition">
                <CheckCircle className="h-3 w-3" /> Marcar como Realizado
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Campanhas() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("campanhas");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [activeCampaignMessages, setActiveCampaignMessages] = useState<CampaignMessage[]>([]);
  

  // Wizard form
  const [form, setForm] = useState({
    nome: "",
    nicho_filtro: "",
    cidade_filtro: "",
    estado_filtro: "",
    status_filtro: "",
    delay_min: 30,
    delay_max: 120,
    limite_leads: 60,
    texto_manual: "",
    usar_ia: true,
  });
  const [leadsCount, setLeadsCount] = useState(0);
  useEffect(() => { fetchCampaigns(); }, []);


  async function fetchCampaigns() {
    setLoading(true);
    const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (!error) setCampaigns(data || []);
    setLoading(false);
  }

  async function fetchCampaignMessages(campaignId: string) {
    const { data } = await supabase.from("campaign_messages").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(50);
    setActiveCampaignMessages(data || []);
  }

  // Count leads matching wizard filters
  const countLeads = useCallback(async () => {
    if (!user) return;
    let q = supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("whatsapp", "is", null);
    if (form.nicho_filtro) q = q.ilike("nicho", `%${form.nicho_filtro}%`);
    if (form.cidade_filtro) q = q.ilike("cidade", `%${form.cidade_filtro}%`);
    if (form.estado_filtro) q = q.eq("estado", form.estado_filtro);
    if (form.status_filtro) q = q.eq("status_funil", form.status_filtro);
    const { count } = await q;
    setLeadsCount(count || 0);
  }, [user, form.nicho_filtro, form.cidade_filtro, form.estado_filtro, form.status_filtro]);

  useEffect(() => { if (wizardStep === 2) countLeads(); }, [wizardStep, countLeads]);

  async function createCampaign() {
    if (!form.nome.trim()) return;
    const delay = Math.max(form.delay_min, 30);
    const { data, error } = await supabase.from("campaigns").insert({
      nome: form.nome,
      nicho_filtro: form.nicho_filtro,
      cidade_filtro: form.cidade_filtro,
      estado_filtro: form.estado_filtro,
      delay_segundos: delay,
      quantidade_por_dia: form.limite_leads,
      status: "pausada",
      total_leads: Math.min(leadsCount, form.limite_leads),
    }).select().single();
    if (error) { toast({ title: "Erro ao criar campanha", variant: "destructive" }); return; }
    toast({ title: `Campanha "${form.nome}" criada com sucesso!` });
    setCampaigns(prev => [data, ...prev]);
    resetWizard();
  }

  function resetWizard() {
    setWizardOpen(false); setWizardStep(1);
    setForm({ nome: "", nicho_filtro: "", cidade_filtro: "", estado_filtro: "", status_filtro: "", delay_min: 30, delay_max: 120, limite_leads: 60, texto_manual: "", usar_ia: true });
  }

  async function toggleCampaign(campaign: Campaign) {
    if (campaign.status === "ativa") {
      await supabase.from("campaigns").update({ status: "pausada" }).eq("id", campaign.id);
      await supabase.functions.invoke("campaign-engine", { body: { action: "pause", campaign_id: campaign.id } });
      toast({ title: "Campanha pausada" });
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: "pausada" } : c));
    } else {
      const { error } = await supabase.functions.invoke("campaign-engine", { body: { action: "start", campaign_id: campaign.id } });
      if (error) { toast({ title: "Erro ao iniciar. Verifique Z-API.", variant: "destructive" }); return; }
      await supabase.from("campaigns").update({ status: "ativa" }).eq("id", campaign.id);
      toast({ title: "Campanha iniciada!" });
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: "ativa" } : c));
    }
  }

  async function deleteCampaign(id: string) {
    await supabase.from("campaigns").delete().eq("id", id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast({ title: "Campanha removida" });
  }

  const statusColor = (s: string) => ({
    ativa: "bg-green-500/20 text-green-400 border-green-500/30",
    pausada: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    concluida: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  }[s] ?? "bg-secondary text-muted-foreground border-border");

  

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground">Campanhas</h1>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setWizardOpen(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        </div>
      </header>

      {/* WhatsApp status bar */}
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <WhatsAppConnect />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 shrink-0">
        {([
          { id: "campanhas" as Tab, label: "Campanhas", icon: Zap },
          { id: "conversas" as Tab, label: "Conversas Recentes", icon: MessageCircle },
          { id: "agenda" as Tab, label: "Agenda", icon: Calendar },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2",
              tab === t.id ? "text-primary border-primary bg-primary/10" : "text-muted-foreground border-transparent hover:text-foreground")}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-6 pt-4">
        {tab === "campanhas" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total", value: campaigns.length, icon: Zap },
                { label: "Ativas", value: campaigns.filter(c => c.status === "ativa").length, icon: Play },
                { label: "Enviadas", value: campaigns.reduce((a, c) => a + c.total_enviados, 0), icon: Send },
                { label: "Leads", value: campaigns.reduce((a, c) => a + c.total_leads, 0), icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="h-4 w-4 text-primary" /></div>
                  <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold text-foreground">{value}</p></div>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Zap className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
                <Button variant="outline" onClick={() => setWizardOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Criar primeira campanha</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map(campaign => {
                  const pct = campaign.total_leads > 0 ? Math.round((campaign.total_enviados / campaign.total_leads) * 100) : 0;
                  return (
                    <div key={campaign.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{campaign.nome}</h3>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusColor(campaign.status))}>{campaign.status}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>🎯 {campaign.nicho_filtro || "Todos"}</span>
                            {campaign.cidade_filtro && <span>📍 {campaign.cidade_filtro}</span>}
                            <span><Clock className="h-3 w-3 inline mr-0.5" />{campaign.delay_segundos}s</span>
                            <span><Users className="h-3 w-3 inline mr-0.5" />{campaign.total_leads} leads</span>
                            <span><Send className="h-3 w-3 inline mr-0.5" />{campaign.total_enviados} enviados</span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{pct}% concluído</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedCampaign(campaign); fetchCampaignMessages(campaign.id); }} className="gap-1 h-8 border-border">
                            <MessageSquare className="h-3 w-3" /> Msgs
                          </Button>
                          <Button size="sm" onClick={() => toggleCampaign(campaign)}
                            className={campaign.status === "ativa"
                              ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30 h-8 gap-1"
                              : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 h-8 gap-1"}>
                            {campaign.status === "ativa" ? <><Pause className="h-3 w-3" /> Pausar</> : <><Play className="h-3 w-3" /> Iniciar</>}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteCampaign(campaign.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "conversas" && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Conversas recentes aparecerão aqui quando o agente estiver ativo</p>
            <div className="flex gap-2">
              {["Todas", "Ativo", "Receptivo", "Manual"].map(f => (
                <button key={f} className="px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border text-muted-foreground">{f}</button>
              ))}
            </div>
          </div>
        )}

        {tab === "agenda" && (
          <AgendaTab />
        )}
      </div>

      {/* ── Wizard Modal ── */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Steps indicator */}
            <div className="flex items-center px-6 pt-5 pb-3 gap-2">
              {[1,2,3,4].map(s => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors",
                    wizardStep >= s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border")}>
                    {s}
                  </div>
                  {s < 4 && <div className={cn("flex-1 h-0.5 rounded-full", wizardStep > s ? "bg-primary" : "bg-border")} />}
                </div>
              ))}
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* Step 1: Nome */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Nome da Campanha</h3>
                    <p className="text-sm text-muted-foreground">Dê um nome descritivo para identificar sua campanha</p>
                  </div>
                  <Input placeholder='Ex: "Prospecção Dentistas SP"' value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="bg-secondary border-border" />
                </>
              )}

              {/* Step 2: Leads */}
              {wizardStep === 2 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Seleção de Leads</h3>
                    <p className="text-sm text-muted-foreground">Filtre os leads da Biblioteca para incluir na campanha</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Nicho / Palavra-chave *</label>
                    <SearchableDropdown
                      options={NICHOS}
                      value={form.nicho_filtro}
                      onChange={(v) => setForm(f => ({ ...f, nicho_filtro: v }))}
                      placeholder="Ex: Restaurantes, Dentistas..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Etapa do Funil</label>
                      <select value={form.status_filtro} onChange={e => setForm(f => ({ ...f, status_filtro: e.target.value }))}
                        className="w-full h-10 rounded-md border border-border bg-secondary px-3 text-sm text-foreground">
                        <option value="">Todos</option>
                        {["Novo","Contato","Negociando","Proposta","Ganho","Perdido"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Estado</label>
                      <select value={form.estado_filtro} onChange={e => setForm(f => ({ ...f, estado_filtro: e.target.value }))}
                        className="w-full h-10 rounded-md border border-border bg-secondary px-3 text-sm text-foreground">
                        <option value="">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm font-medium text-foreground">Leads encontrados <span className="text-primary font-bold">{leadsCount}</span> com telefone</p>
                    <p className="text-xs text-muted-foreground mt-1">Leads selecionados: {Math.min(leadsCount, form.limite_leads)}/{form.limite_leads}</p>
                  </div>

                  <button onClick={() => setForm(f => ({ ...f, nicho_filtro: "", cidade_filtro: "", estado_filtro: "", status_filtro: "" }))}
                    className="text-xs text-muted-foreground hover:text-foreground">🗑️ Limpar filtros</button>
                </>
              )}

              {/* Step 3: Config */}
              {wizardStep === 3 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Configuração da Campanha</h3>
                    <p className="text-sm text-muted-foreground">Defina intervalos e limites de envio</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Intervalo entre mensagens</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Mín (s)</label>
                        <Input type="number" min={30} max={300} value={form.delay_min} onChange={e => setForm(f => ({ ...f, delay_min: Number(e.target.value) }))} className="bg-secondary border-border" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Máx (s)</label>
                        <Input type="number" min={30} max={300} value={form.delay_max} onChange={e => setForm(f => ({ ...f, delay_max: Number(e.target.value) }))} className="bg-secondary border-border" />
                      </div>
                    </div>
                    {form.delay_min < 120 && (
                      <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" /> Intervalos curtos aumentam risco de ban</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Limite de leads por dia (máx 60)</label>
                    <Input type="number" min={1} max={60} value={form.limite_leads} onChange={e => setForm(f => ({ ...f, limite_leads: Math.min(60, Number(e.target.value)) }))} className="bg-secondary border-border w-28" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground block">Texto do disparo</label>
                    <div className="flex gap-2">
                      <button onClick={() => setForm(f => ({ ...f, usar_ia: false }))}
                        className={cn("flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                          !form.usar_ia ? "border-primary bg-primary/20 text-primary" : "border-border bg-secondary text-muted-foreground")}>
                        ✏️ Manual
                      </button>
                      <button onClick={() => setForm(f => ({ ...f, usar_ia: true }))}
                        className={cn("flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                          form.usar_ia ? "border-primary bg-primary/20 text-primary" : "border-border bg-secondary text-muted-foreground")}>
                        🤖 IA
                      </button>
                    </div>
                    {!form.usar_ia ? (
                      <textarea value={form.texto_manual} onChange={e => setForm(f => ({ ...f, texto_manual: e.target.value }))} rows={3}
                        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                        placeholder="Digite o texto do disparo..." />
                    ) : (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground">🤖 O agente IA gerará textos únicos baseados no nicho, descrição do negócio e técnicas BRAT/SPIN</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Revisão Geral</h3>
                    <p className="text-sm text-muted-foreground">Confirme os dados antes de criar a campanha</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Nome", value: form.nome },
                      { label: "Nicho", value: form.nicho_filtro || "Todos" },
                      { label: "Leads", value: `${Math.min(leadsCount, form.limite_leads)} com telefone` },
                      { label: "Intervalo", value: `${form.delay_min}s – ${form.delay_max}s` },
                      { label: "Limite/dia", value: `${form.limite_leads}` },
                      { label: "Tipo", value: "WhatsApp" },
                      { label: "Texto", value: form.usar_ia ? "Gerado por IA" : "Manual" },
                      { label: "Status", value: "RASCUNHO" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Nav buttons */}
              <div className="flex gap-2 pt-2">
                {wizardStep > 1 ? (
                  <Button variant="outline" onClick={() => setWizardStep((wizardStep - 1) as WizardStep)} className="gap-1 border-border">
                    <ChevronLeft className="h-4 w-4" /> Voltar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={resetWizard} className="border-border">Cancelar</Button>
                )}
                <div className="flex-1" />
                {wizardStep < 4 ? (
                  <Button onClick={() => setWizardStep((wizardStep + 1) as WizardStep)} className="gap-1 bg-primary text-primary-foreground"
                    disabled={wizardStep === 1 && !form.nome.trim()}>
                    Próximo <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={createCampaign} className="gap-1 bg-primary text-primary-foreground">
                    <Zap className="h-4 w-4" /> Criar Campanha
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h3 className="font-semibold text-foreground">{selectedCampaign.nome}</h3>
                <p className="text-xs text-muted-foreground">{activeCampaignMessages.length} mensagens</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {activeCampaignMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem enviada ainda</p>
                </div>
              ) : activeCampaignMessages.map(msg => (
                <div key={msg.id} className="bg-secondary rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-xs font-medium", msg.status === "enviado" ? "text-green-400" : msg.status === "respondido" ? "text-blue-400" : "text-yellow-400")}>
                      ● {msg.status}
                    </span>
                    {msg.enviado_em && <span className="text-xs text-muted-foreground">{new Date(msg.enviado_em).toLocaleString("pt-BR")}</span>}
                  </div>
                  <p className="text-sm text-foreground">{msg.mensagem}</p>
                  {msg.resposta && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Resposta:</p>
                      <p className="text-sm text-primary">{msg.resposta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
