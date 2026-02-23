import { useState, useEffect, useRef, useCallback } from "react";
import { Smartphone, Wifi, WifiOff, RefreshCw, X, QrCode, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppAccount {
  id: string;
  instance_id: string | null;
  token: string | null;
  numero: string | null;
  status: string;
  modo_disparo: boolean;
  modo_ia: boolean;
  connected_at: string | null;
}

export default function WhatsAppConnect() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const connectedCount = accounts.filter((a) => a.status === "conectado").length;
  const LIMIT = 10;

  useEffect(() => {
    loadAccounts();
    return () => { stopPolling(); stopCountdown(); stopStatusPoll(); };
  }, []);

  useEffect(() => {
    if (accounts.length > 0) startStatusPoll();
    return () => stopStatusPoll();
  }, [accounts.length]);

  // Auto-select first account
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts, selectedAccount]);

  async function loadAccounts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const accs = data || [];
      setAccounts(accs);
      for (const acc of accs) await syncAccountStatus(acc);
    } catch (err) {
      console.error("Error loading WhatsApp accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function syncAccountStatus(acc: WhatsAppAccount) {
    try {
      const { data } = await supabase.functions.invoke("zapi-proxy", {
        body: { action: "status", instance_id: acc.instance_id, token: acc.token },
      });
      const connected = data?.connected === true || data?.status === "connected" || data?.status === "conectado";
      if (connected && acc.status !== "conectado") {
        let numero = acc.numero;
        if (!numero) numero = await fetchPhoneNumber(acc);
        await supabase.from("whatsapp_accounts").update({ status: "conectado", connected_at: new Date().toISOString(), ...(numero ? { numero } : {}) }).eq("id", acc.id);
        setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, status: "conectado", numero: numero || a.numero } : a));
      } else if (!connected && acc.status === "conectado") {
        await supabase.from("whatsapp_accounts").update({ status: "desconectado" }).eq("id", acc.id);
        setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, status: "desconectado" } : a));
      }
    } catch (err) { console.error("Sync status error:", err); }
  }

  async function fetchPhoneNumber(acc: WhatsAppAccount): Promise<string | null> {
    try {
      const { data } = await supabase.functions.invoke("zapi-proxy", {
        body: { action: "get-phone", instance_id: acc.instance_id, token: acc.token },
      });
      return data?.phone || data?.numero || data?.value || null;
    } catch { return null; }
  }

  function stopPolling() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }
  function stopCountdown() { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } }
  function stopStatusPoll() { if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null; } }

  function startStatusPoll() {
    stopStatusPoll();
    statusPollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("whatsapp_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      if (data) { for (const acc of data) await syncAccountStatus(acc); setAccounts(data); }
    }, 30000);
  }

  const fetchQrCode = useCallback(async (accountId: string) => {
    setQrLoading(true);
    setQrImage(null);
    try {
      const account = accounts.find((a) => a.id === accountId);
      const { data, error } = await supabase.functions.invoke("zapi-proxy", {
        body: { action: "qr-code", instance_id: account?.instance_id, token: account?.token },
      });
      if (error) throw error;
      const qrValue = data?.value || data?.qrcode || data?.qr;
      if (qrValue) {
        const src = qrValue.startsWith("data:") ? qrValue : `data:image/png;base64,${qrValue}`;
        setQrImage(src);
        setCountdown(30);
        startCountdown();
        startPolling(accountId);
      } else {
        toast({ title: "QR Code indisponível", description: "Tente novamente em alguns segundos.", variant: "destructive" });
      }
    } catch (err) {
      console.error("QR fetch error:", err);
      toast({ title: "Erro ao buscar QR", description: "Verifique as credenciais da Z-API.", variant: "destructive" });
    } finally { setQrLoading(false); }
  }, [accounts, toast]);

  function startCountdown() {
    stopCountdown();
    let seconds = 30;
    countdownRef.current = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      if (seconds <= 0) { stopCountdown(); setQrImage(null); }
    }, 1000);
  }

  function startPolling(accountId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const account = accounts.find((a) => a.id === accountId);
        const { data } = await supabase.functions.invoke("zapi-proxy", {
          body: { action: "status", instance_id: account?.instance_id, token: account?.token },
        });
        const connected = data?.connected === true || data?.status === "connected" || data?.status === "conectado";
        if (connected) {
          stopPolling(); stopCountdown(); setShowQrModal(false); setQrImage(null);
          let numero: string | null = null;
          if (account) numero = await fetchPhoneNumber(account);
          await supabase.from("whatsapp_accounts").update({ status: "conectado", connected_at: new Date().toISOString(), ...(numero ? { numero } : {}) }).eq("id", accountId);
          toast({ title: "✅ WhatsApp conectado!", description: numero ? `Número: ${numero}` : "O agente está pronto para operar." });
          loadAccounts();
        }
      } catch (err) { console.error("Status poll error:", err); }
    }, 5000);
  }

  async function handleConnect() {
    if (connectedCount >= LIMIT) {
      toast({ title: "Limite atingido", description: `Máximo de ${LIMIT} WhatsApps conectados.`, variant: "destructive" });
      return;
    }
    let account = accounts.find((a) => a.status !== "conectado");
    if (!account) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("whatsapp_accounts").insert({ user_id: user.id, status: "aguardando" }).select().single();
      if (error) { toast({ title: "Erro", description: "Não foi possível criar a instância.", variant: "destructive" }); return; }
      account = data;
      setAccounts((prev) => [...prev, data]);
    } else {
      await supabase.from("whatsapp_accounts").update({ status: "aguardando" }).eq("id", account.id);
    }
    setActiveAccountId(account.id);
    setShowQrModal(true);
    fetchQrCode(account.id);
  }

  async function handleDisconnect(accountId: string) {
    try {
      await supabase.from("whatsapp_accounts").update({ status: "desconectado", connected_at: null }).eq("id", accountId);
      setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, status: "desconectado", connected_at: null } : a));
      if (selectedAccount?.id === accountId) setSelectedAccount((prev) => prev ? { ...prev, status: "desconectado" } : null);
      toast({ title: "WhatsApp desconectado" });
    } catch (err) { console.error("Disconnect error:", err); }
  }

  async function toggleModo(accountId: string, field: 'modo_disparo' | 'modo_ia') {
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) return;

      const newValue = !account[field];
      await supabase.from("whatsapp_accounts").update({ [field]: newValue }).eq("id", accountId);

      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, [field]: newValue } : a));
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(prev => prev ? { ...prev, [field]: newValue } : null);
      }

      const label = field === 'modo_disparo' ? 'Modo Ativo' : 'Modo Receptivo';
      toast({
        title: `${label} ${newValue ? 'Ligado' : 'Desligado'}`,
        description: newValue ? `O número agora ${field === 'modo_disparo' ? 'realiza disparos' : 'responde mensagens'}.` : "Função desativada para este número."
      });
    } catch (err) { console.error("Toggle modo error:", err); }
  }

  const dotColor = (status: string) =>
    status === "conectado" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : status === "aguardando" ? "bg-yellow-500 animate-pulse" : "bg-red-500";

  const statusLabel = (status: string) =>
    status === "conectado" ? "Conectado" : status === "aguardando" ? "Aguardando QR" : "Desconectado";

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-12 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seus WhatsApps</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {connectedCount}/{LIMIT} conectados
          </span>
        </div>

        {/* Horizontal chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">Nenhuma instância configurada</p>
          ) : (
            accounts.map((acc, i) => {
              const isSelected = selectedAccount?.id === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all shrink-0 ${isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/40 hover:border-primary/40"
                    }`}
                >
                  <div className="relative">
                    <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary">
                      AG
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${dotColor(acc.status)}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground leading-tight">Agente IA</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {acc.status === "conectado" && acc.numero
                        ? acc.numero
                        : acc.status === "aguardando"
                          ? "Aguardando QR"
                          : "Desconectado"}
                    </p>
                  </div>
                  {i > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">Extra</span>
                  )}
                </button>
              );
            })
          )}

          {/* Add button (small) */}
          {accounts.length < LIMIT && (
            <button
              onClick={handleConnect}
              className="h-11 px-3 rounded-full border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition shrink-0 flex items-center gap-1.5"
            >
              <QrCode className="h-3.5 w-3.5" />
              Conectar
            </button>
          )}
        </div>

        {/* WhatsApp Extra upsell */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 text-xs font-medium border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground transition">
              <Smartphone className="h-3.5 w-3.5" />
              WhatsApp Extra
            </button>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">R$29,90/mês</span>
          </div>
          <button className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition">
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Selected account detail bar */}
        {selectedAccount && (
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {selectedAccount.numero || "WhatsApp sem número"}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor(selectedAccount.status)}`} />
                  {statusLabel(selectedAccount.status)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedAccount.status === "conectado" ? (
                  <button
                    onClick={() => handleDisconnect(selectedAccount.id)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition"
                  >
                    <WifiOff className="h-3 w-3" /> Desconectar
                  </button>
                ) : selectedAccount.status === "aguardando" ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 animate-pulse">
                    Aguardando QR...
                  </span>
                ) : (
                  <button
                    onClick={() => { setActiveAccountId(selectedAccount.id); setShowQrModal(true); fetchQrCode(selectedAccount.id); }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition"
                  >
                    <QrCode className="h-3 w-3" /> Conectar
                  </button>
                )}
              </div>
            </div>

            {/* Mode Selection */}
            {selectedAccount.status === "conectado" && (
              <div className="bg-secondary/30 rounded-xl p-3 space-y-3 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Funcionalidades</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleModo(selectedAccount.id, 'modo_disparo')}
                      className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                        selectedAccount.modo_disparo ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground")}
                    >
                      🚀 ATIVO
                    </button>
                    <button
                      onClick={() => toggleModo(selectedAccount.id, 'modo_ia')}
                      className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                        selectedAccount.modo_ia ? "bg-indigo-500 text-white border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]" : "bg-card text-muted-foreground border-border hover:text-foreground")}
                    >
                      🎯 RECEPTIVO
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1">
                    {selectedAccount.modo_disparo ? <span className="text-primary font-bold">● Ativo:</span> : <span className="text-muted-foreground">○ Ativo:</span>} Envia disparos de campanhas.
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1">
                    {selectedAccount.modo_ia ? <span className="text-indigo-400 font-bold">● Receptivo:</span> : <span className="text-muted-foreground">○ Receptivo:</span>} IA SDR responde mensagens.
                  </p>
                  {!selectedAccount.modo_disparo && !selectedAccount.modo_ia && (
                    <p className="text-[10px] text-yellow-500/80 italic mt-1 font-medium">⚠️ Chip em descanso: recebe mensagens mas não reage.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#1a1c2e] p-8 space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <button onClick={closeModal} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition">
              <X className="h-5 w-5" />
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-foreground">Conectar WhatsApp</h3>
              <p className="text-xs text-muted-foreground">Escaneie o QR Code com seu WhatsApp Business</p>
            </div>
            <div className="flex items-center justify-center min-h-[240px] rounded-xl border border-border bg-secondary/30">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">Gerando QR Code...</p>
                </div>
              ) : qrImage ? (
                <img src={qrImage} alt="QR Code WhatsApp" className="w-56 h-56 rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <QrCode className="h-12 w-12 opacity-30" />
                  <p className="text-xs">QR Code expirado</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Aguardando leitura...</span>
              </div>
              {countdown > 0 && <span className="text-xs font-mono text-muted-foreground">Expira em {countdown}s</span>}
            </div>
            <button
              onClick={() => activeAccountId && fetchQrCode(activeAccountId)}
              disabled={qrLoading}
              className="w-full h-10 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 border border-border bg-secondary/50 text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} />
              Atualizar QR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
