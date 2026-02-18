import { Shield, Users, Settings, Database, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  user_id: string;
  nome: string;
  email: string;
  plano: string;
  created_at: string;
  role?: string;
}

export default function Admin() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string> = {};
      roles?.forEach((r) => { roleMap[r.user_id] = r.role; });
      const merged = (profiles ?? []).map((p) => ({ ...p, role: roleMap[p.user_id] ?? "user" }));
      setUsers(merged as UserRow[]);
      setLoading(false);
    }
    load();
  }, []);

  async function promoteToAdmin(userId: string, email: string) {
    const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Promovido!", description: `${email} agora é administrador.` });
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: "admin" } : u));
    }
  }

  async function demoteToUser(userId: string, email: string) {
    const { error } = await supabase.from("user_roles").update({ role: "user" }).eq("user_id", userId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rebaixado", description: `${email} agora é usuário comum.` });
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: "user" } : u));
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[hsl(var(--hunter-orange)/0.15)] flex items-center justify-center border border-[hsl(var(--hunter-orange)/0.3)]">
          <Shield className="h-5 w-5 text-[hsl(var(--hunter-orange))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Acesso restrito — apenas administradores</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Total de usuários", value: users.length, color: "hunter-blue" },
          { icon: Shield, label: "Administradores", value: users.filter((u) => u.role === "admin").length, color: "hunter-orange" },
          { icon: Activity, label: "Usuários comuns", value: users.filter((u) => u.role === "user").length, color: "hunter-success" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(var(--hunter-card-bg))] p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg bg-[hsl(var(--${color})/0.15)] flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 text-[hsl(var(--${color}))]`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela de usuários */}
      <div className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(var(--hunter-card-bg))] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[hsl(var(--hunter-border))]">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">Gerenciar Usuários</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--hunter-border))]">
                  {["Nome", "E-mail", "Plano", "Papel", "Cadastro", "Ações"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-b border-[hsl(var(--hunter-border)/0.5)] hover:bg-[hsl(var(--hunter-blue)/0.04)] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.nome || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--hunter-blue)/0.1)] text-[hsl(var(--hunter-blue))] border border-[hsl(var(--hunter-blue)/0.2)]">
                        {u.plano}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                        u.role === "admin"
                          ? "bg-[hsl(var(--hunter-orange)/0.1)] text-[hsl(var(--hunter-orange))] border-[hsl(var(--hunter-orange)/0.3)]"
                          : "bg-[hsl(var(--hunter-success)/0.1)] text-[hsl(var(--hunter-success))] border-[hsl(var(--hunter-success)/0.3)]"
                      }`}>
                        {u.role === "admin" ? "Administrador" : "Usuário"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {u.user_id === profile?.user_id ? (
                        <span className="text-xs text-muted-foreground italic">Você</span>
                      ) : u.role === "admin" ? (
                        <button
                          onClick={() => demoteToUser(u.user_id, u.email)}
                          className="text-xs px-3 py-1 rounded-lg border border-[hsl(var(--hunter-danger)/0.4)] text-[hsl(var(--hunter-danger))] hover:bg-[hsl(var(--hunter-danger)/0.1)] transition-colors"
                        >
                          Revogar admin
                        </button>
                      ) : (
                        <button
                          onClick={() => promoteToAdmin(u.user_id, u.email)}
                          className="text-xs px-3 py-1 rounded-lg border border-[hsl(var(--hunter-orange)/0.4)] text-[hsl(var(--hunter-orange))] hover:bg-[hsl(var(--hunter-orange)/0.1)] transition-colors"
                        >
                          Tornar admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info sobre configurações do sistema */}
      <div className="rounded-xl border border-[hsl(var(--hunter-border))] bg-[hsl(var(--hunter-card-bg))] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">Informações do Sistema</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: "Banco de Dados", value: "Lovable Cloud (Supabase)" },
            { label: "RLS", value: "Ativo — isolamento por user_id" },
            { label: "Autenticação", value: "Email/Senha com perfis" },
            { label: "Roles", value: "admin | user (tabela user_roles)" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground">{label}: </span>
                <span className="text-foreground font-medium">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
