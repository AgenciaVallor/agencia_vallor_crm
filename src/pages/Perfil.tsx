import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  User, Mail, Shield, Smartphone, CheckCircle, Wifi, WifiOff,
  QrCode, Loader2, Save, RefreshCw, Unplug
} from "lucide-react";

interface WhatsAppAccount {
  id?: string;
  instance_id: string;
  token: string;
  numero: string;
  status: string;
  qr_code: string | null;
}

export default function PerfilPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  // Profile form
  const [nome, setNome] = useState(profile?.nome ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // WhatsApp form
  const [wa, setWa] = useState<WhatsAppAccount>({
    instance_id: "",
    token: "",
    numero: "",
    status: "desconectado",
    qr_code: null,
  });
  const [loadingWa, setLoadingWa] = useState(true);
  const [savingWa, setSavingWa] = useState(false);
  const [testingWa, setTestingWa] = useState(false);

  useEffect(() => {
    if (profile) setNome(profile.nome);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    loadWhatsApp();
  }, [user]);

  async function loadWhatsApp() {
    setLoadingWa(true);
    const { data } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("user_id", user!.id)
      .single();
    if (data) {
      setWa({
        id: data.id,
        instance_id: data.instance_id ?? "",
        token: data.token ?? "",
        numero: data.numero ?? "",
        status: data.status ?? "desconectado",
        qr_code: data.qr_code ?? null,
      });
    }
    setLoadingWa(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nome })
        .eq("user_id", user!.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Perfil atualizado!", description: "Suas informações foram salvas." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar o perfil.", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    setSavingWa(true);
    try {
      const payload = {
        user_id: user!.id,
        instance_id: wa.instance_id,
        token: wa.token,
        numero: wa.numero,
        status: "desconectado",
      };
      let error;
      if (wa.id) {
        ({ error } = await supabase.from("whatsapp_accounts").update(payload).eq("id", wa.id));
      } else {
        ({ error } = await supabase.from("whatsapp_accounts").insert(payload));
      }
      if (error) throw error;
      toast({ title: "WhatsApp salvo!", description: "Credenciais da Z-API salvas com sucesso." });
      loadWhatsApp();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar as credenciais.", variant: "destructive" });
    } finally {
      setSavingWa(false);
    }
  }

  async function handleTestConnection() {
    if (!wa.instance_id || !wa.token) {
      toast({ title: "Preencha as credenciais", description: "Instance ID e Token são obrigatórios.", variant: "destructive" });
      return;
    }
    setTestingWa(true);
    try {
      // Test Z-API connection
      const res = await fetch(
        `https://api.z-api.io/instances/${wa.instance_id}/token/${wa.token}/status`,
        { headers: { "Content-Type": "application/json" } }
      );
      const data = await res.json();
      const connected = data.connected || data.status === "connected" || data.value === "CONNECTED";

      const newStatus = connected ? "conectado" : "desconectado";
      const numero = data.smartphoneConnected ? (data.phone ?? wa.numero) : wa.numero;

      await supabase
        .from("whatsapp_accounts")
        .update({ status: newStatus, numero })
        .eq("id", wa.id!);

      setWa((prev) => ({ ...prev, status: newStatus, numero }));

      if (connected) {
        toast({ title: "✅ WhatsApp conectado!", description: `Número: ${numero}` });
      } else {
        toast({ title: "⚠️ WhatsApp desconectado", description: "Verifique suas credenciais na Z-API.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível verificar o status da Z-API.", variant: "destructive" });
    } finally {
      setTestingWa(false);
    }
  }

  async function handleDisconnect() {
    if (!wa.id) return;
    await supabase
      .from("whatsapp_accounts")
      .update({ status: "desconectado", qr_code: null })
      .eq("id", wa.id);
    setWa((prev) => ({ ...prev, status: "desconectado", qr_code: null }));
    toast({ title: "WhatsApp desconectado." });
  }

  const isConnected = wa.status === "conectado";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-[hsl(220_26%_9%)] shrink-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-5 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground">Perfil & Conta</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
            isConnected
              ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
              : "bg-red-400/10 border-red-400/30 text-red-400"
          }`}>
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            WhatsApp {isConnected ? "Conectado" : "Desconectado"}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-3xl">

        {/* ── PROFILE CARD ── */}
        <div className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(var(--hunter-border))]">
            <User className="h-4 w-4 text-[hsl(var(--hunter-blue))]" />
            <h2 className="font-semibold text-foreground text-sm">Dados do Perfil</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[hsl(var(--hunter-blue))] flex items-center justify-center shrink-0">
                <span className="text-white text-2xl font-bold">
                  {(nome || user?.email || "U")[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{nome || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[hsl(var(--hunter-orange)/0.15)] border border-[hsl(var(--hunter-orange)/0.3)] text-xs font-medium text-[hsl(var(--hunter-orange))]">
                  <Shield className="h-3 w-3" /> {profile?.plano ?? "Free"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={user?.email ?? ""}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground opacity-50 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(var(--hunter-blue))] hover:bg-[hsl(var(--hunter-blue-dark))] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar perfil
              </button>
            </div>
          </form>
        </div>

        {/* ── WHATSAPP CARD ── */}
        <div className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(var(--hunter-border))]">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-400" />
              <h2 className="font-semibold text-foreground text-sm">Conexão WhatsApp (Z-API)</h2>
            </div>
            {isConnected && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                {wa.numero}
              </div>
            )}
          </div>

          {loadingWa ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSaveWhatsApp} className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure suas credenciais da <strong className="text-foreground">Z-API</strong> para conectar seu WhatsApp e receber leads automaticamente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instance ID</label>
                  <input
                    value={wa.instance_id}
                    onChange={(e) => setWa((p) => ({ ...p, instance_id: e.target.value }))}
                    placeholder="Ex: 3EEE44D2A9A261..."
                    className="w-full px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--emerald-400/0.4))] transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Token</label>
                  <input
                    type="password"
                    value={wa.token}
                    onChange={(e) => setWa((p) => ({ ...p, token: e.target.value }))}
                    placeholder="Seu token Z-API"
                    className="w-full px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Número WhatsApp (opcional)</label>
                <input
                  value={wa.numero}
                  onChange={(e) => setWa((p) => ({ ...p, numero: e.target.value }))}
                  placeholder="Ex: 5511999999999"
                  className="w-full px-3 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors"
                />
              </div>

              {/* Status badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                isConnected
                  ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
                  : "bg-red-400/10 border-red-400/20 text-red-400"
              }`}>
                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span className="font-medium">Status: {wa.status}</span>
                {isConnected && wa.numero && <span className="text-xs opacity-70 ml-auto">{wa.numero}</span>}
              </div>

              {/* QR Code display */}
              {wa.qr_code && !isConnected && (
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[hsl(var(--hunter-border))] bg-[hsl(var(--hunter-card-bg))]">
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Escaneie com seu WhatsApp</p>
                  <img src={wa.qr_code} alt="QR Code" className="w-48 h-48 rounded-lg" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingWa}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] hover:border-emerald-400/50 text-sm font-medium text-foreground transition-colors disabled:opacity-60"
                >
                  {savingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar credenciais
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingWa || !wa.instance_id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {testingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Testar conexão
                </button>

                {isConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
                  >
                    <Unplug className="h-4 w-4" />
                    Desconectar
                  </button>
                )}
              </div>

              <div className="rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] p-3 space-y-1">
                <p className="text-xs font-medium text-foreground">Como obter credenciais Z-API:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse <strong>app.z-api.io</strong> e crie uma instância</li>
                  <li>Copie o <strong>Instance ID</strong> e o <strong>Token</strong> da instância</li>
                  <li>Cole os dados acima e clique em "Testar conexão"</li>
                  <li>Configure o webhook da Z-API para: <code className="bg-background px-1 rounded text-[hsl(var(--hunter-blue))]">…/functions/v1/zapi-webhook</code></li>
                </ol>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
