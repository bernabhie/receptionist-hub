import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, ClipboardList, Sparkles, Receipt, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/appointments", label: "Appointments", icon: ClipboardList },
  { to: "/predictive", label: "Predictive AI", icon: Sparkles },
  { to: "/billing", label: "Billing", icon: Receipt },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-64 flex-col border-r bg-sidebar">
        <div className="p-5 border-b">
          <BrandLogo />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-brand-gradient text-primary-foreground shadow-brand"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="px-3 py-2 text-xs">
            <div className="font-medium truncate">{user?.email}</div>
            <div className="text-muted-foreground capitalize">{roles.join(", ") || "no role"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Top bar - mobile */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur">
        <BrandLogo size={32} />
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {open && (
        <div className="md:hidden border-b bg-card p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                  active ? "bg-brand-gradient text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      )}

      <main className="md:pl-64">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
