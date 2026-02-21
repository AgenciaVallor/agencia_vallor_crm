import { useState, useEffect, useRef, useCallback } from "react";
import { Smartphone, Wifi, WifiOff, RefreshCw, X, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppAccount {
  id: string;
  instance_id: string | null;
  token: string | null;
  numero: string | null;
  status: string;
  connected_at: string | null;
}

const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  conectado: { dot: "bg-green-500", label: "Conectado" },
  desconectado: { dot: "bg-red-500", label: "Desconectado" },
  aguardando: { dot: "bg-yellow-500", label: "Aguardando QR" },
};

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
  const { toast } = useToast();

  const connectedCount = accounts.filter((a) => a.status === "conectado").length;
  const LIMIT = 2;

  // Load accounts
  useEffect(() => {
    loadAccounts();
    return () => {
      stopPolling();
      stopCountdown();
    };
  }, []);

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
      setAccounts(data || []);
    } catch (err) {
      console.error("Error loading WhatsApp accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function stopCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  const fetchQrCode = useCallback(async (accountId: string) => {
    setQrLoading(true);
    setQrImage(null);

    try {
      const account = accounts.find((a) => a.id === accountId);
      const { data, error } = await supabase.functions.invoke("zapi-proxy", {
        body: {
          action: "qr-code",
          instance_id: account?.instance_id,
          token: account?.token,
        },
      });

      if (error) throw error;

      // Z-API returns { value: "base64..." } or { qrcode: "base64..." }
      const qrValue = data?.value || data?.qrcode || data?.qr;
      if (qrValue) {
        const src = qrValue.startsWith("data:") ? qrValue : `data:image/png;base64,${qrValue}`;
        setQrImage(src);
        setCountdown(30);
        startCountdown(accountId);
        startPolling(accountId);
      } else {
        toast({ title: "QR Code indisponível", description: "Tente novamente em alguns segundos.", variant: "destructive" });
      }
    } catch (err) {
      console.error("QR fetch error:", err);
      toast({ title: "Erro ao buscar QR", description: "Verifique as credenciais da Z-API.", variant: "destructive" });
    } finally {
      setQrLoading(false);
    }
  }, [accounts, toast]);

  function startCountdown(accountId: string) {
    stopCountdown();
    let seconds = 30;
    countdownRef.current = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      if (seconds <= 0) {
        stopCountdown();
        setQrImage(null);
      }
    }, 1000);
  }

  function startPolling(accountId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const account = accounts.find((a) => a.id === accountId);
        const { data } = await supabase.functions.invoke("zapi-proxy", {
          body: {
            action: "status",
            instance_id: account?.instance_id,
            token: account?.token,
          },
        });

        const connected = data?.connected === true || data?.status === "connected" || data?.status === "conectado";

        if (connected) {
          stopPolling();
          stopCountdown();
          setShowQrModal(false);
          setQrImage(null);

          // Update DB
          await supabase
            .from("whatsapp_accounts")
            .update({
              status: "conectado",
              connected_at: new Date().toISOString(),
            })
            .eq("id", accountId);

          toast({ title: "✅ WhatsApp conectado!", description: "O agente está pronto para operar." });
          loadAccounts();
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    }, 5000);
  }

  async function handleConnect() {
    if (connectedCount >= LIMIT) {
      toast({ title: "Limite atingido", description: `Máximo de ${LIMIT} WhatsApps conectados.`, variant: "destructive" });
      return;
    }

    // Use existing account or create new
    let account = accounts.find((a) => a.status !== "conectado");
    if (!account) {
      // Create a new account entry
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .insert({ user_id: user.id, status: "aguardando" })
        .select()
        .single();

      if (error) {
        toast({ title: "Erro", description: "Não foi possível criar a instância.", variant: "destructive" });
        return;
      }
      account = data;
      setAccounts((prev) => [...prev, data]);
    } else {
      await supabase.from("whatsapp_accounts").update({ status: "aguardando" }).eq("id", account.id);
    }

    setActiveAccountId(account.id);
    setShowQrModal(true);
    fetchQrCode(account.id);
  }

  function closeModal() {
    setShowQrModal(false);
    setQrImage(null);
    stopPolling();
    stopCountdown();
  }

  const statusInfo = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.desconectado;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-5 w-48 bg-muted rounded mb-3" />
        <div className="h-10 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card card-glow-blue p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground text-sm">Seus WhatsApps</h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
            LIMITE DE {LIMIT}/{connectedCount} conectados
          </span>
        </div>

        {/* Instances list */}
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3 border border-dashed border-border rounded-lg">
              Nenhuma instância configurada
            </p>
          ) : (
            accounts.map((acc) => {
              const info = statusInfo(acc.status);
              return (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/30"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${info.dot} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {acc.status === "conectado"
                        ? `Agente IA ${acc.numero || "(sem número)"}`
                        : "Agente IA Aguardando QR"}
                    </p>
                    <p className="text-xs text-muted-foreground">{info.label}</p>
                  </div>
                  {acc.status === "conectado" && (
                    <Wifi className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  {acc.status !== "conectado" && (
                    <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={connectedCount >= LIMIT}
          className="w-full h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <QrCode className="h-4 w-4" />
          Conectar WhatsApp via QR
        </button>
      </section>

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card p-6 space-y-5 shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-foreground">Conectar WhatsApp</h3>
              <p className="text-xs text-muted-foreground">
                Escaneie o QR Code com seu WhatsApp Business
              </p>
            </div>

            {/* QR Code area */}
            <div className="flex items-center justify-center min-h-[240px] rounded-xl border border-border bg-secondary/30">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">Gerando QR Code...</p>
                </div>
              ) : qrImage ? (
                <img
                  src={qrImage}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <QrCode className="h-12 w-12 opacity-30" />
                  <p className="text-xs">QR Code expirado</p>
                </div>
              )}
            </div>

            {/* Countdown + status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Aguardando leitura...</span>
              </div>
              {countdown > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  Expira em {countdown}s
                </span>
              )}
            </div>

            {/* Refresh button */}
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
