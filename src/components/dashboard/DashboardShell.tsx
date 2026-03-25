import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CircleHelp,
  CreditCard,
  Database,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Mic,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlanBadge } from "@/components/PlanBadge";
import { useAuth } from "@/hooks/use-auth";

interface DashboardShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

const navItems = [
  { to: "/dashboard", label: "Conversations", icon: LayoutDashboard },
  { to: "/dashboard/data-sources", label: "Data Sources", icon: Database },
  { to: "/dashboard/workflows", label: "Workflows", icon: GitBranch },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/voice", label: "Voice Controls", icon: Bot },
  { to: "/dashboard/developer", label: "Developer", icon: KeyRound },
  { to: "/dashboard/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/dashboard/integrations", label: "Integrations", icon: LinkIcon },
  { to: "/dashboard/profile", label: "Profile", icon: User },
  { to: "/dashboard/faq", label: "Help / FAQ", icon: CircleHelp },
];

export function DashboardShell({ title, description, children }: DashboardShellProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
    toast({ title: "Logged out", description: "See you soon!" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-72 border-r border-border bg-card hidden md:flex md:flex-col">
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <h1 className="font-heading font-bold text-xl text-foreground">
              Vox<span className="text-primary">AI</span>
            </h1>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <PlanBadge />
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
