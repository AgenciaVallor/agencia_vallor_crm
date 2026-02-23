import { useState, useEffect, useRef, useCallback } from "react";
import { Smartphone, WifiOff, RefreshCw, QrCode, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const LIMIT = 10;
  const connectedCount = accounts.filter((a) => a.status === "conectado").length;

  useEffect(() => {
    loadAccounts();
    return () => { stopPolling(); stopCountdown(); stopStatusPoll(); };
  }, []);

  useEffect(() => {
    if (accounts.length > 0) startStatusPoll();
    return () => stopStatusPoll();
  }, [accounts.length]);

  const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  const stopCountdown = () => { if (countdownRef.current) clearInterval(countdownRef.current); countdownRef.current = null; };
  const stopStatusPoll = () => { if (statusPollRef.current) clearInterval(statusPollRef.current); statusPollRef.current = null; };

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

      // Sync each account status on load
      for (const acc of accs) {
        syncAccountStatus(acc);
      }
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
        const numero = await fetchPhoneNumber(acc);
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

  function startStatusPoll() {
    stopStatusPoll();
    statusPollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("whatsapp_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      if (data) {
        setAccounts(data);
        for (const acc of data) if (acc.status === "conectado" || acc.status === "desconectado") syncAccountStatus(acc);
      }
    }, 60000); // Check status every minute
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
        startPollingConnection(accountId);
      } else {
        toast({ title: "QR Code indisponível", description: "Verifique os tokens Z-API.", variant: "destructive" });
      }
    } catch (err) {
      console.error("QR fetch error:", err);
      toast({ title: "Erro ao buscar QR", description: "Falha na comunicação com Z-API.", variant: "destructive" });
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

  function startPollingConnection(accountId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const account = accounts.find((a) => a.id === accountId);
        const { data } = await supabase.functions.invoke("zapi-proxy", {
          body: { action: "status", instance_id: account?.instance_id, token: account?.token },
        });
        const connected = data?.connected === true || data?.status === "connected" || data?.status === "conectado";
        if (connected) {
          stopPolling(); stopCountdown(); setShowQrModal(false);
          const numero = await fetchPhoneNumber(account!);
          await supabase.from("whatsapp_accounts").update({ status: "conectado", connected_at: new Date().toISOString(), numero }).eq("id", accountId);
          toast({ title: "✅ WhatsApp conectado!", description: `Identificado: ${numero || 'Número ativo'}` });
          loadAccounts();
        }
      } catch (err) { console.error("Poll connection error:", err); }
    }, 4000);
  }

  async function handleCreateAndConnect() {
    if (accounts.length >= LIMIT) {
      toast({ title: "Limite de 10 números atingido", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase.from("whatsapp_accounts")
      .insert({ user_id: user.id, status: "aguardando" })
      .select().single();
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao criar instância", variant: "destructive" });
      return;
    }

    setActiveAccountId(data.id);
    setShowQrModal(true);
    fetchQrCode(data.id);
  }

  async function openQrModal(acc: WhatsAppAccount) {
    setActiveAccountId(acc.id);
    setShowQrModal(true);
    fetchQrCode(acc.id);
  }

  async function handleDisconnect(accId: string) {
    await supabase.from("whatsapp_accounts").update({ status: "desconectado" }).eq("id", accId);
    setAccounts(prev => prev.map(a => a.id === accId ? { ...a, status: "desconectado" } : a));
    toast({ title: "Número desconectado" });
  }

  async function toggleModo(accountId: string, field: 'modo_disparo' | 'modo_ia') {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    const newVal = !acc[field];
    await supabase.from("whatsapp_accounts").update({ [field]: newVal }).eq("id", accountId);
    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, [field]: newVal } : a));
    toast({ title: `Modo ${field === 'modo_disparo' ? 'Ativo' : 'Receptivo'} ${newVal ? 'Ligado' : 'Desligado'}` });
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "conectado": return { label: "Conectado", dot: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]", text: "text-emerald-400" };
      case "aguardando": return { label: "Aguardando QR", dot: "bg-amber-500 animate-pulse", text: "text-amber-400" };
      default: return { label: "Desconectado", dot: "bg-red-500", text: "text-red-400" };
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Carregando WhatsApps...</div>;

  return (
    <div className="space-y-6">
      {/* HEADER STATUS */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">Status da Rede</h3>
            <p className="text-xs text-slate-500 mt-1">Conectados: <span className="text-emerald-400 font-bold">{connectedCount}/{LIMIT}</span></p>
          </div>
        </div>
        <button
          onClick={handleCreateAndConnect}
          disabled={accounts.length >= LIMIT}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar Slot
        </button>
      </div>

      {/* GRID DE INSTÂNCIAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc, i) => {
          const info = getStatusInfo(acc.status);
          return (
            <div key={acc.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-white/20 transition-all group relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-black/40 flex items-center justify-center border border-white/5 font-black text-slate-600 text-lg">
                      {i + 1}
                    </div>
                    <div className={cn("absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0f111a]", info.dot)} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white truncate max-w-[120px]">{acc.numero || `Slot ${i + 1} Livre`}</h4>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest mt-0.5", info.text)}>{info.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {acc.status === "conectado" ? (
                    <button onClick={() => handleDisconnect(acc.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-red-400 transition-colors" title="Desconectar">
                      <WifiOff className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => openQrModal(acc)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 transition-all active:scale-95">
                      Conectar
                    </button>
                  )}
                </div>
              </div>

              {acc.status === "conectado" && (
                <div className="pt-3 border-t border-white/5 flex gap-2">
                  <button
                    onClick={() => toggleModo(acc.id, 'modo_disparo')}
                    className={cn("flex-1 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                      acc.modo_disparo ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20" : "bg-black/20 border-white/5 text-slate-600 hover:text-slate-400")}
                  >
                    🚀 Ativo
                  </button>
                  <button
                    onClick={() => toggleModo(acc.id, 'modo_ia')}
                    className={cn("flex-1 h-9 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                      acc.modo_ia ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-black/20 border-white/5 text-slate-600 hover:text-slate-400")}
                  >
                    🎯 Receptivo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL QR CODE */}
      {showQrModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0f111a] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl p-8 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white">Conectar WhatsApp</h3>
            <p className="text-xs text-slate-500 px-4">Abra o WhatsApp no seu celular, toque em <span className="text-slate-300 font-bold">Aparelhos conectados</span> e escaneie o código abaixo.</p>

            <div className="relative aspect-square w-full bg-white rounded-2xl flex items-center justify-center p-4 border-4 border-white/5 overflow-hidden">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="h-10 w-10 text-purple-500 animate-spin" />
                  <p className="text-[10px] font-black text-slate-400 uppercase">Gerando QR...</p>
                </div>
              ) : qrImage ? (
                <img src={qrImage} alt="QR Code" className="w-full h-full" />
              ) : (
                <div className="text-center space-y-2">
                  <QrCode className="h-12 w-12 text-slate-200 mx-auto opacity-20" />
                  <p className="text-[10px] font-black text-slate-400 uppercase">QR Expirado</p>
                </div>
              )}

              {countdown > 0 && !qrLoading && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                  {countdown}s
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => activeAccountId && fetchQrCode(activeAccountId)}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <RefreshCw className={cn("h-4 w-4", qrLoading && "animate-spin")} />
                Atualizar Código
              </button>
              <button onClick={() => { setShowQrModal(false); stopPolling(); stopCountdown(); }} className="w-full py-3 text-slate-500 hover:text-white text-xs font-bold transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
