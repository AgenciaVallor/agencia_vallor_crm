import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminGuard } from "@/components/AdminGuard";
import Dashboard from "./pages/Dashboard";
import AgenteIA from "./pages/AgenteIA";
import Campanhas from "./pages/Campanhas";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Biblioteca from "./pages/Biblioteca";
import CRM from "./pages/CRM";
import Insights from "./pages/Insights";
import Emails from "./pages/Emails";
import Agenda from "./pages/Agenda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background dark">
        <AppSidebar />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Rotas protegidas — qualquer usuário logado */}
            <Route path="/" element={<AuthGuard><Layout><Dashboard /></Layout></AuthGuard>} />
            <Route path="/agente" element={<AuthGuard><Layout><AgenteIA /></Layout></AuthGuard>} />
            <Route path="/campanhas" element={<AuthGuard><Layout><Campanhas /></Layout></AuthGuard>} />
            <Route path="/perfil" element={<AuthGuard><Layout><Perfil /></Layout></AuthGuard>} />
            <Route path="/biblioteca" element={<AuthGuard><Layout><Biblioteca /></Layout></AuthGuard>} />
            <Route path="/crm" element={<AuthGuard><Layout><CRM /></Layout></AuthGuard>} />
            <Route path="/insights" element={<AuthGuard><Layout><Insights /></Layout></AuthGuard>} />
            <Route path="/emails" element={<AuthGuard><Layout><Emails /></Layout></AuthGuard>} />
            <Route path="/agenda" element={<AuthGuard><Layout><Agenda /></Layout></AuthGuard>} />
            {/* Rota exclusiva do administrador */}
            <Route path="/admin" element={<AuthGuard><AdminGuard><Layout><Admin /></Layout></AdminGuard></AuthGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

