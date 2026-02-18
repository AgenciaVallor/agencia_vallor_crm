import { useState, useEffect } from "react";
import { Bot, Plus, X, Save, Zap, MessageSquare, Target, Brain, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { NICHOS } from "@/data/nichos";
import { SearchableDropdown } from "@/components/SearchableDropdown";

interface AgenteConfig {
  id?: string;
  nome_agente: string;
  estilo: string;
  descricao_produto: string;
  nicho: string;
  missao: string;
  agressividade: number;
  objecoes: string[];
  argumentos: string[];
  system_prompt: string;
}

const DEFAULT_CONFIG: AgenteConfig = {
  nome_agente: "Hunter",
  estilo: "Humano",
  descricao_produto: "",
  nicho: "",
  missao: "",
  agressividade: 5,
  objecoes: [],
  argumentos: [],
  system_prompt: "",
};

function buildSystemPrompt(config: AgenteConfig): string {
  const argumentosStr = config.argumentos.length
    ? config.argumentos.map((a, i) => `${i + 1}. ${a}`).join("; ")
    : "nenhum argumento cadastrado";
  const obujecoesStr = config.objecoes.length
    ? config.objecoes.map((o) => `"${o}"`).join(", ")
    : "nenhuma restrição cadastrada";

  return `Você é ${config.nome_agente}, um especialista em ${config.nicho || "vendas"}. ${config.descricao_produto ? `Você vende: ${config.descricao_produto}.` : ""} Sua missão é ${config.missao || "converter leads em clientes"}. Seja ${config.agressividade}/10 agressivo na venda — quanto maior o número, mais direto e insistente você deve ser. Use estes argumentos de venda: ${argumentosStr}. Nunca diga ou mencione: ${obujecoesStr}. Estilo de comunicação: ${config.estilo === "Humano" ? "fale de forma natural, empática e humanizada, sem parecer um robô" : "pode revelar que é uma IA, mas mantenha profissionalismo"}.`;
}

function getAgressividadeLabel(value: number): { label: string; color: string } {
  if (value <= 2) return { label: "Suave", color: "hsl(var(--hunter-success))" };
  if (value <= 4) return { label: "Moderado", color: "hsl(var(--hunter-blue))" };
  if (value <= 6) return { label: "Equilibrado", color: "hsl(var(--hunter-warn))" };
  if (value <= 8) return { label: "Agressivo", color: "hsl(25 95% 55%)" };
  return { label: "Máximo", color: "hsl(var(--hunter-danger))" };
}

export default function AgenteIAPage() {
  const [config, setConfig] = useState<AgenteConfig>(DEFAULT_CONFIG);
  const [novaObjecao, setNovaObjecao] = useState("");
  const [novoArgumento, setNovoArgumento] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [promptPreview, setPromptPreview] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    setConfig((prev) => ({ ...prev, system_prompt: buildSystemPrompt(prev) }));
  }, [
    config.nome_agente,
    config.estilo,
    config.nicho,
    config.missao,
    config.descricao_produto,
    config.agressividade,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(config.objecoes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(config.argumentos),
  ]);

  async function loadConfig() {
    try {
      const { data, error } = await supabase
        .from("agente_config")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        setConfig({
          id: data.id,
          nome_agente: data.nome_agente,
          estilo: data.estilo,
          descricao_produto: data.descricao_produto,
          nicho: data.nicho,
          missao: data.missao,
          agressividade: data.agressividade,
          objecoes: data.objecoes || [],
          argumentos: data.argumentos || [],
          system_prompt: data.system_prompt,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const prompt = buildSystemPrompt(config);
      const payload = { ...config, system_prompt: prompt };

      let error;
      if (config.id) {
        ({ error } = await supabase.from("agente_config").update(payload).eq("id", config.id));
      } else {
        const { data, error: insertError } = await supabase
          .from("agente_config")
          .insert(payload)
          .select()
          .single();
        error = insertError;
        if (data) setConfig((prev) => ({ ...prev, id: data.id }));
      }

      if (error) throw error;

      toast({
        title: "✅ Configuração salva!",
        description: "O System Prompt do Agente IA foi atualizado com sucesso.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function addObjecao() {
    const val = novaObjecao.trim();
    if (!val || config.objecoes.includes(val)) return;
    setConfig((prev) => ({ ...prev, objecoes: [...prev.objecoes, val] }));
    setNovaObjecao("");
  }

  function removeObjecao(idx: number) {
    setConfig((prev) => ({ ...prev, objecoes: prev.objecoes.filter((_, i) => i !== idx) }));
  }

  function addArgumento() {
    const val = novoArgumento.trim();
    if (!val || config.argumentos.includes(val)) return;
    setConfig((prev) => ({ ...prev, argumentos: [...prev.argumentos, val] }));
    setNovoArgumento("");
  }

  function removeArgumento(idx: number) {
    setConfig((prev) => ({ ...prev, argumentos: prev.argumentos.filter((_, i) => i !== idx) }));
  }

  const agressLabel = getAgressividadeLabel(config.agressividade);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Bot className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-sm leading-tight">Configuração do Agente IA</h1>
            <p className="text-xs text-muted-foreground">Personalize o comportamento do seu agente de vendas</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">

        {/* ── SEÇÃO 1: Identidade ── */}
        <section className="rounded-xl border border-border bg-card card-glow-blue p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground text-sm">Identidade</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Nome do Agente
              </label>
              <input
                type="text"
                value={config.nome_agente}
                onChange={(e) => setConfig((p) => ({ ...p, nome_agente: e.target.value }))}
                placeholder="Ex: Hunter, Sofia, Max..."
                className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition"
              />
            </div>

            {/* Estilo */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Estilo do Agente
              </label>
              <div className="flex gap-2">
                {["Humano", "IA"].map((estilo) => (
                  <button
                    key={estilo}
                    onClick={() => setConfig((p) => ({ ...p, estilo }))}
                    className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all ${
                      config.estilo === estilo
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {estilo === "Humano" ? "👤 Humano" : "🤖 IA"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SEÇÃO 2: Negócio ── */}
        <section className="rounded-xl border border-border bg-card card-glow-blue p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground text-sm">Negócio</h2>
          </div>

          {/* Descrição do produto */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Descrição do Produto / Serviço
            </label>
            <textarea
              value={config.descricao_produto}
              onChange={(e) => setConfig((p) => ({ ...p, descricao_produto: e.target.value }))}
              placeholder="Ex: Desenvolvemos sites profissionais para pequenas empresas com entrega em 7 dias..."
              rows={3}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition resize-none"
            />
          </div>

          {/* Nicho */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nicho / Segmento
            </label>
            <SearchableDropdown
              options={NICHOS}
              value={config.nicho}
              onChange={(val) => setConfig((p) => ({ ...p, nicho: val }))}
              placeholder="Selecione ou pesquise o nicho..."
            />
          </div>

          {/* Missão */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Missão do Agente
            </label>
            <textarea
              value={config.missao}
              onChange={(e) => setConfig((p) => ({ ...p, missao: e.target.value }))}
              placeholder="Ex: Agendar uma reunião de diagnóstico gratuito com o dono do negócio..."
              rows={2}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition resize-none"
            />
          </div>
        </section>

        {/* ── SEÇÃO 3: Comportamento ── */}
        <section className="rounded-xl border border-border bg-card card-glow-blue p-5 space-y-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground text-sm">Comportamento</h2>
          </div>

          {/* Slider Agressividade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Agressividade de Vendas
              </label>
              <div
                className="text-sm font-bold px-3 py-0.5 rounded-full border"
                style={{
                  color: agressLabel.color,
                  borderColor: agressLabel.color + "44",
                  backgroundColor: agressLabel.color + "15",
                }}
              >
                {config.agressividade}/10 — {agressLabel.label}
              </div>
            </div>

            <div className="px-1">
              <Slider
                min={1}
                max={10}
                step={1}
                value={[config.agressividade]}
                onValueChange={([val]) => setConfig((p) => ({ ...p, agressividade: val }))}
                className="w-full"
              />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>1 — Suave</span>
              <span>5 — Equilibrado</span>
              <span>10 — Máximo</span>
            </div>
          </div>

          {/* Objeções comuns */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <X className="h-3.5 w-3.5 text-destructive" />
              O Que NÃO Falar (Objeções Bloqueadas)
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={novaObjecao}
                onChange={(e) => setNovaObjecao(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addObjecao()}
                placeholder="Ex: não sei, talvez, depende... (Enter para adicionar)"
                className="flex-1 h-9 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition"
              />
              <button
                onClick={addObjecao}
                className="h-9 w-9 rounded-lg border border-primary/40 bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition text-primary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {config.objecoes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed border-border rounded-lg">
                Nenhuma objeção cadastrada
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {config.objecoes.map((obj, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-destructive/30 bg-destructive/10 text-destructive"
                  >
                    🚫 {obj}
                    <button onClick={() => removeObjecao(i)} className="hover:text-foreground transition">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Argumentos de venda */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Argumentos de Venda
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={novoArgumento}
                onChange={(e) => setNovoArgumento(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addArgumento()}
                placeholder="Ex: entrega em 7 dias, suporte 24h, garantia de resultado... (Enter)"
                className="flex-1 h-9 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition"
              />
              <button
                onClick={addArgumento}
                className="h-9 w-9 rounded-lg border border-primary/40 bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition text-primary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {config.argumentos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-2 border border-dashed border-border rounded-lg">
                Nenhum argumento cadastrado
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {config.argumentos.map((arg, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-sm text-foreground"
                  >
                    <span className="text-primary font-bold text-xs w-5 text-center">{i + 1}</span>
                    <span className="flex-1">{arg}</span>
                    <button
                      onClick={() => removeArgumento(i)}
                      className="text-muted-foreground hover:text-destructive transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── System Prompt Preview ── */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <button
            onClick={() => setPromptPreview((p) => !p)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              Pré-visualização do System Prompt
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${promptPreview ? "rotate-180" : ""}`}
            />
          </button>
          {promptPreview && (
            <div className="rounded-lg bg-secondary/40 border border-border p-3 text-xs text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">
              {buildSystemPrompt(config) || "Preencha os campos acima para gerar o prompt..."}
            </div>
          )}
        </section>

        {/* ── Botão Salvar ── */}
        <button
          onClick={saveConfig}
          disabled={saving}
          className="w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed card-glow-blue"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
