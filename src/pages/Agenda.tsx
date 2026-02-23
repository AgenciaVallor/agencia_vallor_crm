import { useState, useEffect } from "react";
import { Calendar, Clock, Mail, User, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agendamento {
  id: string;
  lead_id: string | null;
  data_hora: string;
  email_lead: string;
  nome_lead: string | null;
  titulo: string;
  descricao: string | null;
  calendly_event_uuid: string | null;
  meeting_link: string | null;
  status: string;
  created_at: string;
  leads?: { nome_empresa: string; nicho: string } | null;
}

export default function AgendaPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAgendamentos();
  }, []);

  async function loadAgendamentos() {
    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*, leads(nome_empresa, nicho)")
        .order("data_hora", { ascending: true });

      if (error) throw error;
      setAgendamentos((data as any) || []);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao carregar agenda", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      setAgendamentos((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      toast({ title: `Status atualizado para "${status}"` });
    }
  }

  const statusColor: Record<string, string> = {
    agendado: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    confirmado: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    cancelado: "text-red-400 bg-red-400/10 border-red-400/30",
    realizado: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-sm leading-tight">Agenda</h1>
            <p className="text-xs text-muted-foreground">Reuniões agendadas pelo Agente IA</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        {agendamentos.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground font-medium">Sua agenda está vazia.</p>
            <p className="text-xs text-muted-foreground">Quando o agente agendar reuniões, elas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentos.map((ag) => (
              <div key={ag.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground text-sm">{ag.titulo}</h3>
                    {ag.leads && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ag.leads.nome_empresa} — {ag.leads.nicho}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[ag.status] || "text-muted-foreground"}`}>
                    {ag.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(ag.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {ag.email_lead}
                  </span>
                  {ag.nome_lead && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {ag.nome_lead}
                    </span>
                  )}
                </div>

                {ag.meeting_link && (
                  <a
                    href={ag.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition w-fit"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver no Calendly
                  </a>
                )}

                {ag.descricao && (
                  <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2">{ag.descricao}</p>
                )}

                <div className="flex gap-2">
                  {ag.status === "agendado" && (
                    <>
                      <button
                        onClick={() => updateStatus(ag.id, "confirmado")}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
                      >
                        <CheckCircle className="h-3 w-3" /> Confirmar
                      </button>
                      <button
                        onClick={() => updateStatus(ag.id, "cancelado")}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition"
                      >
                        <XCircle className="h-3 w-3" /> Cancelar
                      </button>
                    </>
                  )}
                  {ag.status === "confirmado" && (
                    <button
                      onClick={() => updateStatus(ag.id, "realizado")}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition"
                    >
                      <CheckCircle className="h-3 w-3" /> Marcar como Realizado
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
