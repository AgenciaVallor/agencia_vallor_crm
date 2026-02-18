import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldOff } from "lucide-react";
import { ReactNode } from "react";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center dark">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--hunter-blue))]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center dark gap-4">
        <ShieldOff className="h-16 w-16 text-[hsl(var(--hunter-danger))]" />
        <h1 className="text-2xl font-bold text-foreground">Acesso Restrito</h1>
        <p className="text-muted-foreground text-sm">Esta área é exclusiva para administradores.</p>
        <a href="/" className="mt-2 text-sm text-[hsl(var(--hunter-blue))] hover:underline">
          ← Voltar ao Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
