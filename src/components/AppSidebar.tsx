import { LayoutDashboard, Library, Mail, Users, BarChart2, Bot, User, Megaphone } from "lucide-react";
import { useLocation } from "react-router-dom";
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

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Biblioteca", url: "/biblioteca", icon: Library },
  { title: "Emails", url: "/emails", icon: Mail },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "Insights", url: "/insights", icon: BarChart2 },
  { title: "Agente IA", url: "/agente", icon: Bot },
  { title: "Perfil", url: "/perfil", icon: User },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--hunter-blue))] shrink-0">
            <span className="text-white font-bold text-xs">VC</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="font-bold text-sidebar-foreground text-sm leading-tight">VAllor CRM</p>
            <p className="text-xs text-muted-foreground">Captura de Leads</p>
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

      <div className="p-3 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center px-2 py-1">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--hunter-blue))] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">U</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">Usuário</p>
            <p className="text-xs text-muted-foreground truncate">Plano Pro</p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
