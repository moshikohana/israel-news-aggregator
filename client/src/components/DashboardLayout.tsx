import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { Calendar, Home as HomeIcon, LogOut, MessageSquare, Settings, Users, Vote, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

export const NAV_ITEMS = [
  { icon: HomeIcon, label: "בית", path: "/", adminOnly: false },
  { icon: MessageSquare, label: "צ'אט", path: "/chat", adminOnly: false },
  { icon: Users, label: "חברים", path: "/members", adminOnly: false },
  { icon: Vote, label: "פריימריז", path: "/primaries", adminOnly: false },
  { icon: Calendar, label: "אירועים", path: "/events", adminOnly: false },
  { icon: Settings, label: "ניהול", path: "/admin", adminOnly: false },
  { icon: ShieldCheck, label: "יומן ביקורת", path: "/audit", adminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg">
              CRM
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">CRM פוליטי חכם</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              מערכת לניהול חברי מרכז, מתפקדים ופעילים. נדרשת התחברות כדי להמשיך.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg"
          >
            התחברות עם Manus
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const navItems = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <>
      <Sidebar side="right" collapsible="icon" className="border-l">
        <SidebarHeader className="h-16 justify-center">
          <div className="flex items-center gap-3 px-2 w-full">
            <div className="h-9 w-9 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold shrink-0">
              CRM
            </div>
            <span className="font-bold tracking-tight truncate group-data-[collapsible=icon]:hidden">
              פוליטי חכם
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarMenu className="px-2 py-2 gap-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className="h-11 transition-all"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-right group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                    {user?.email || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="ml-2 h-4 w-4" />
                <span>התנתקות</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Mobile top bar */}
        <div className="flex md:hidden border-b h-14 items-center gap-3 bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            CRM
          </div>
          <span className="font-bold tracking-tight">פוליטי חכם</span>
        </div>

        <main className="flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-4">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur grid pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </SidebarInset>
    </>
  );
}
