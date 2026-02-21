import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center dark">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--hunter-blue))]" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
      toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar email.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[hsl(var(--vallor-purple)/0.08)] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[hsl(var(--vallor-purple)/0.05)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo + Header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="h-16 w-16 rounded-2xl bg-[hsl(var(--vallor-purple))] flex items-center justify-center shadow-2xl">
            <span className="text-white text-2xl font-black tracking-tight">CV</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">CRM VALLOR</h1>
            <p className="text-sm text-muted-foreground">Agência de Publicidade</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "text-foreground border-b-2 border-[hsl(var(--vallor-purple))] bg-[hsl(var(--vallor-purple)/0.07)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "text-foreground border-b-2 border-[hsl(var(--vallor-purple))] bg-[hsl(var(--vallor-purple)/0.07)]"
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--vallor-purple)/0.7)] transition-colors"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--vallor-purple)/0.7)] transition-colors"
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
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--vallor-purple)/0.7)] transition-colors"
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
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white bg-[hsl(var(--vallor-purple))] hover:bg-[hsl(var(--vallor-purple-dark))] transition-all duration-200 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</>
              ) : mode === "login" ? (
                "Entrar na plataforma"
              ) : (
                "Criar minha conta"
              )}
            </button>

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="w-full text-center text-xs text-muted-foreground hover:text-[hsl(var(--vallor-purple))] transition-colors mt-1"
              >
                Esqueci minha senha
              </button>
            )}
          </form>

          {/* Forgot password modal */}
          {forgotMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setForgotMode(false); setForgotSent(false); }}>
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-foreground">Recuperar senha</h2>
                {forgotSent ? (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-muted-foreground">Email de recuperação enviado! Verifique sua caixa de entrada.</p>
                    <button onClick={() => { setForgotMode(false); setForgotSent(false); }} className="text-sm text-[hsl(var(--vallor-purple))] hover:underline">Fechar</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          placeholder="seu@email.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--vallor-purple)/0.7)] transition-colors"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[hsl(var(--vallor-purple))] hover:bg-[hsl(var(--vallor-purple-dark))] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</> : "Enviar link de recuperação"}
                    </button>
                    <button type="button" onClick={() => setForgotMode(false)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">Voltar</button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 CRM VALLOR · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}

