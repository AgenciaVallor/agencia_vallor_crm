import vallorLogo from "@/assets/vallor-logo.png";
import { LayoutDashboard, Library, Users, BarChart2, Bot, User, Megaphone, LogOut, ShieldCheck, Mail } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const userNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Biblioteca", url: "/biblioteca", icon: Library },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "Insights", url: "/insights", icon: BarChart2 },
  { title: "Emails", url: "/emails", icon: Mail },
  { title: "Agente IA", url: "/agente", icon: Bot },
  { title: "Perfil", url: "/perfil", icon: User },
];

const adminNavItems = [
  ...userNavItems,
  { title: "Administrador", url: "/admin", icon: ShieldCheck },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, user, signOut, isAdmin } = useAuth();
  const navItems = isAdmin ? adminNavItems : userNavItems;

  const displayName = profile?.nome || user?.email?.split("@")[0] || "Usuário";
  const initial = displayName[0].toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <img
            src={vallorLogo}
            alt="VAllor CRM"
            className="h-8 w-8 rounded-lg object-cover shrink-0"
          />
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="font-bold text-sidebar-foreground text-sm leading-tight">VAllor CRM</p>
            <p className="text-xs text-muted-foreground">Agência de Publicidade</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={isActive
                        ? "bg-[hsl(var(--hunter-blue)/0.15)] text-[hsl(var(--hunter-blue))] border border-[hsl(var(--hunter-blue)/0.3)]"
                        : "hover:bg-sidebar-accent"
                      }
                    >
                      <a href={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="p-3 border-t border-sidebar-border mt-auto space-y-1">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center px-2 py-1">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--hunter-blue))] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initial}</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden min-w-0 flex-1">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.plano ?? "Free"}</p>
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className="group-data-[collapsible=icon]:hidden p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Sidebar>
  );
}
