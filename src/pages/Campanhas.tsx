import { useState, useEffect } from "react";
import { Plus, Play, Pause, Send, MessageSquare, Users, Clock, Zap, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { NICHOS } from "@/data/nichos";

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

type ModalStep = "filtros" | "config" | null;

const ESTADOS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

export default function Campanhas() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalStep, setModalStep] = useState<ModalStep>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [activeCampaignMessages, setActiveCampaignMessages] = useState<CampaignMessage[]>([]);

  const [form, setForm] = useState({
    nome: "",
    nicho_filtro: "",
    cidade_filtro: "",
    estado_filtro: "",
    delay_segundos: 120,
    quantidade_por_dia: 30,
  });

  const [nichoBusca, setNichoBusca] = useState("");
  const [nichoOpen, setNichoOpen] = useState(false);
  const nichosFiltrados = NICHOS.filter(n => n.toLowerCase().includes(nichoBusca.toLowerCase())).slice(0, 40);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar campanhas", variant: "destructive" });
    } else {
      setCampaigns(data || []);
    }
    setLoading(false);
  }

  async function fetchCampaignMessages(campaignId: string) {
    const { data } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(50);
    setActiveCampaignMessages(data || []);
  }

  async function createCampaign() {
    if (!form.nome.trim() || !form.nicho_filtro) {
      toast({ title: "Preencha nome e nicho da campanha", variant: "destructive" });
      return;
    }
    if (form.delay_segundos < 120 || form.delay_segundos > 300) {
      toast({ title: "Delay deve ser entre 120s e 300s", variant: "destructive" });
      return;
    }

    // Count matching leads
    let query = supabase.from("leads").select("id", { count: "exact" });
    if (form.nicho_filtro) query = query.ilike("nicho", `%${form.nicho_filtro}%`);
    if (form.cidade_filtro) query = query.ilike("cidade", `%${form.cidade_filtro}%`);
    if (form.estado_filtro) query = query.eq("estado", form.estado_filtro);

    const { count } = await query;

    const { data, error } = await supabase.from("campaigns").insert({
      nome: form.nome,
      nicho_filtro: form.nicho_filtro,
      cidade_filtro: form.cidade_filtro,
      estado_filtro: form.estado_filtro,
      delay_segundos: form.delay_segundos,
      quantidade_por_dia: form.quantidade_por_dia,
      status: "pausada",
      total_leads: count || 0,
    }).select().single();

    if (error) {
      toast({ title: "Erro ao criar campanha", variant: "destructive" });
    } else {
      toast({ title: `Campanha criada com ${count || 0} leads!` });
      setCampaigns(prev => [data, ...prev]);
      setModalStep(null);
      setForm({ nome: "", nicho_filtro: "", cidade_filtro: "", estado_filtro: "", delay_segundos: 120, quantidade_por_dia: 30 });
    }
  }

  async function toggleCampaign(campaign: Campaign) {
    if (campaign.status === "ativa") {
      // Pause
      await supabase.from("campaigns").update({ status: "pausada" }).eq("id", campaign.id);
      const { error } = await supabase.functions.invoke("campaign-engine", {
        body: { action: "pause", campaign_id: campaign.id }
      });
      if (!error) {
        toast({ title: "Campanha pausada" });
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: "pausada" } : c));
      }
    } else {
      // Start
      const { error } = await supabase.functions.invoke("campaign-engine", {
        body: { action: "start", campaign_id: campaign.id }
      });
      if (error) {
        toast({ title: "Erro ao iniciar campanha. Verifique as credenciais Z-API.", variant: "destructive" });
      } else {
        await supabase.from("campaigns").update({ status: "ativa" }).eq("id", campaign.id);
        toast({ title: "Campanha iniciada! Motor de envio ativado." });
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: "ativa" } : c));
      }
    }
  }

  async function deleteCampaign(id: string) {
    await supabase.from("campaigns").delete().eq("id", id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast({ title: "Campanha removida" });
  }

  function openMessages(campaign: Campaign) {
    setSelectedCampaign(campaign);
    fetchCampaignMessages(campaign.id);
  }

  const statusColor = (s: string) => ({
    ativa: "bg-green-500/20 text-green-400 border-green-500/30",
    pausada: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    concluida: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  }[s] ?? "bg-muted text-muted-foreground");

  const msgStatusColor = (s: string) => ({
    enviado: "text-green-400",
    pendente: "text-yellow-400",
    respondido: "text-blue-400",
    pausado: "text-red-400",
  }[s] ?? "text-muted-foreground");

  return (
    <div className="flex flex-col h-screen bg-background dark text-foreground overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Campanhas e Disparos</h1>
          <p className="text-sm text-muted-foreground">Motor de envio automático via WhatsApp</p>
        </div>
        <Button
          onClick={() => { setModalStep("filtros"); }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 shrink-0">
        {[
          { label: "Total Campanhas", value: campaigns.length, icon: Zap },
          { label: "Ativas", value: campaigns.filter(c => c.status === "ativa").length, icon: Play },
          { label: "Mensagens Enviadas", value: campaigns.reduce((a, c) => a + c.total_enviados, 0), icon: Send },
          { label: "Leads Alcançados", value: campaigns.reduce((a, c) => a + c.total_leads, 0), icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-muted-foreground animate-pulse">Carregando...</div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Zap className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
            <Button variant="outline" onClick={() => setModalStep("filtros")} className="gap-2">
              <Plus className="h-4 w-4" /> Criar primeira campanha
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <Card key={campaign.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{campaign.nome}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(campaign.status)}`}>
                            {campaign.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>🎯 {campaign.nicho_filtro || "Todos"}</span>
                          {campaign.cidade_filtro && <span>📍 {campaign.cidade_filtro}</span>}
                          {campaign.estado_filtro && <span>• {campaign.estado_filtro}</span>}
                          <span><Clock className="h-3 w-3 inline mr-0.5" />{campaign.delay_segundos}s delay</span>
                          <span><Users className="h-3 w-3 inline mr-0.5" />{campaign.total_leads} leads</span>
                          <span><Send className="h-3 w-3 inline mr-0.5" />{campaign.total_enviados} enviados</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMessages(campaign)}
                        className="gap-1 h-8 border-border"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Msgs
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => toggleCampaign(campaign)}
                      className={campaign.status === "ativa"
                          ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30 h-8 gap-1"
                          : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 h-8 gap-1"
                        }
                      >
                        {campaign.status === "ativa" ? <><Pause className="h-3 w-3" /> Pausar</> : <><Play className="h-3 w-3" /> Iniciar</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteCampaign(campaign.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* === MODAL: Filtros === */}
      {modalStep === "filtros" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Nova Campanha — Filtrar Leads</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setModalStep(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Selecione quais leads serão incluídos nesta campanha</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Nome da Campanha *</label>
                <Input
                  placeholder="Ex: Dentistas Curitiba - Março"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>

              {/* Nicho dropdown */}
              <div className="relative">
                <label className="text-sm font-medium text-foreground block mb-1.5">Nicho *</label>
                <div
                  className="flex items-center justify-between h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer"
                  onClick={() => setNichoOpen(o => !o)}
                >
                  <span className={form.nicho_filtro ? "text-foreground" : "text-muted-foreground"}>
                    {form.nicho_filtro || "Selecione o nicho..."}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                {nichoOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-md shadow-lg">
                    <div className="p-2 border-b border-border">
                      <Input
                        placeholder="Buscar nicho..."
                        value={nichoBusca}
                        onChange={e => setNichoBusca(e.target.value)}
                        className="h-8 bg-background border-border"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-auto">
                      <div
                        className="px-3 py-2 text-sm hover:bg-accent cursor-pointer text-muted-foreground"
                        onClick={() => { setForm(f => ({ ...f, nicho_filtro: "" })); setNichoOpen(false); setNichoBusca(""); }}
                      >
                        Todos os nichos
                      </div>
                      {nichosFiltrados.map(n => (
                        <div
                          key={n}
                          className={`px-3 py-2 text-sm hover:bg-accent cursor-pointer ${form.nicho_filtro === n ? "bg-primary/10 text-primary" : "text-foreground"}`}
                          onClick={() => { setForm(f => ({ ...f, nicho_filtro: n })); setNichoOpen(false); setNichoBusca(""); }}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Cidade</label>
                  <Input
                    placeholder="Ex: Curitiba"
                    value={form.cidade_filtro}
                    onChange={e => setForm(f => ({ ...f, cidade_filtro: e.target.value }))}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Estado</label>
                  <select
                    value={form.estado_filtro}
                    onChange={e => setForm(f => ({ ...f, estado_filtro: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Todos</option>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setModalStep("config")}>
                Próximo: Configurar Envio →
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === MODAL: Config Envio === */}
      {modalStep === "config" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Configurar Envio</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setModalStep("filtros")}>
                  ← Voltar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Campanha: <strong className="text-foreground">{form.nome}</strong> — Nicho: <strong className="text-foreground">{form.nicho_filtro || "Todos"}</strong>
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Delay entre mensagens <span className="text-muted-foreground">(mín. 120s — máx. 300s)</span>
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={120}
                    max={300}
                    value={form.delay_segundos}
                    onChange={e => setForm(f => ({ ...f, delay_segundos: Number(e.target.value) }))}
                    className="bg-background border-border w-28"
                  />
                  <span className="text-sm text-muted-foreground">segundos</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${form.delay_segundos < 120 || form.delay_segundos > 300 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {form.delay_segundos < 120 ? "Muito baixo" : form.delay_segundos > 300 ? "Muito alto" : "✓ OK"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Delay aleatório para evitar bloqueios pelo WhatsApp</p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Quantidade por dia
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={form.quantidade_por_dia}
                    onChange={e => setForm(f => ({ ...f, quantidade_por_dia: Number(e.target.value) }))}
                    className="bg-background border-border w-28"
                  />
                  <span className="text-sm text-muted-foreground">mensagens/dia</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recomendamos máx. 50/dia para contas novas</p>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-xs font-medium text-primary mb-2">🤖 Motor de IA Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Cada mensagem será gerada individualmente pela IA usando o perfil do Agente configurado + nome da empresa do lead. Nenhuma mensagem será idêntica.
                </p>
              </div>

              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                onClick={createCampaign}
              >
                <Zap className="h-4 w-4" />
                Criar Campanha
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === MODAL: Messages === */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{selectedCampaign.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{activeCampaignMessages.length} mensagens</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-2">
              {activeCampaignMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma mensagem enviada ainda</p>
                </div>
              ) : (
                activeCampaignMessages.map(msg => (
                  <div key={msg.id} className="bg-background rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${msgStatusColor(msg.status)}`}>
                        ● {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                      </span>
                      {msg.enviado_em && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.enviado_em).toLocaleString("pt-BR")}
                        </span>
                      )}
                      {msg.pausado_por_humano && (
                        <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">⚠ Pausado (resposta humana)</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{msg.mensagem}</p>
                    {msg.resposta && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Resposta do lead:</p>
                        <p className="text-sm text-primary">{msg.resposta}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
