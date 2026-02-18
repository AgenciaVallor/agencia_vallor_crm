import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import vallorLogo from "@/assets/vallor-logo.png";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Mode = "login" | "signup";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center dark">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--hunter-blue))]" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: { nome },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao autenticar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center dark p-4">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[hsl(var(--hunter-blue)/0.06)] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[hsl(var(--hunter-orange)/0.06)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo + Header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="h-16 w-16 rounded-2xl overflow-hidden border border-[hsl(var(--hunter-border))] shadow-lg">
            <img src={vallorLogo} alt="VAllor CRM" className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">VAllor CRM</h1>
            <p className="text-sm text-muted-foreground">Agência de Publicidade</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[hsl(var(--hunter-border))] bg-[hsl(220_26%_9%)] shadow-2xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-[hsl(var(--hunter-border))]">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "text-foreground border-b-2 border-[hsl(var(--hunter-blue))] bg-[hsl(var(--hunter-blue)/0.05)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "text-foreground border-b-2 border-[hsl(var(--hunter-orange))] bg-[hsl(var(--hunter-orange)/0.05)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[hsl(var(--hunter-card-bg))] border border-[hsl(var(--hunter-border))] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--hunter-blue)/0.6)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 mt-2 ${
                mode === "login"
                  ? "bg-[hsl(var(--hunter-blue))] hover:bg-[hsl(var(--hunter-blue-dark))]"
                  : "bg-[hsl(var(--hunter-orange))] hover:bg-[hsl(var(--hunter-orange-glow))]"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</>
              ) : mode === "login" ? (
                "Entrar na plataforma"
              ) : (
                "Criar minha conta"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2025 VAllor CRM · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
