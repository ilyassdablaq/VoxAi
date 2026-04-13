import { ReactNode, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Shield,
  BarChart3,
  Bot,
  CircleHelp,
  CreditCard,
  Database,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Link as LinkIcon,
  LucideIcon,
  LogOut,
  Menu,
  Mic,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlanBadge } from "@/components/PlanBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface DashboardShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

interface MenuItemConfig {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  onClick?: () => void;
}

interface MenuSectionConfig {
  title: string;
  items: MenuItemConfig[];
}

interface MenuSectionProps extends MenuSectionConfig {
  onItemClick?: (item: MenuItemConfig) => void;
}

const getPlanLabel = (planType?: "FREE" | "PRO" | "ENTERPRISE") => {
  if (!planType) return "Free Plan";
  return `${planType} Plan`;
};

function MenuItem({ to, label, icon: Icon, end, onClick }: MenuItemConfig) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex w-full min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]"
            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
        }`
      }
    >
      <span className="flex w-full items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="leading-none">{label}</span>
      </span>
    </NavLink>
  );
}

function MenuSection({ title, items, onItemClick }: MenuSectionProps) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85">{title}</h3>
      <div className="space-y-1">
        {items.map((item) => (
          <MenuItem
            key={item.to + item.label}
            {...item}
            onClick={() => {
              item.onClick?.();
              onItemClick?.(item);
            }}
          />
        ))}
      </div>
    </section>
  );
}

export function DashboardShell({ title, description, children }: DashboardShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { logout, subscription, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const coreItems: MenuItemConfig[] = [
    { to: "/dashboard", label: "Conversations", icon: LayoutDashboard, end: true },
    { to: "/dashboard/data-sources", label: "Data Sources", icon: Database },
  ];

  const advancedItems: MenuItemConfig[] = [
    { to: "/dashboard/workflows", label: "Workflows", icon: GitBranch },
    { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/dashboard/voice", label: "Voice Controls", icon: Bot },
  ];

  const developerItems: MenuItemConfig[] = [
    { to: "/dashboard/developer", label: "Developer", icon: KeyRound },
    { to: "/dashboard/integrations", label: "Integrations", icon: LinkIcon },
  ];

  const accountItems: MenuItemConfig[] = [
    { to: "/dashboard/profile", label: "Profile", icon: User },
    { to: "/dashboard/subscriptions", label: "Subscriptions", icon: CreditCard },
    ...(user?.role === "ADMIN" ? [{ to: "/dashboard/admin", label: "Admin Panel", icon: Shield }] : []),
    { to: "/dashboard/faq", label: "Help / FAQ", icon: CircleHelp },
    { to: "/", label: "Logout", icon: LogOut, onClick: handleLogout },
  ];

  const menuSections: MenuSectionConfig[] = [
    { title: "Core Features", items: coreItems },
    { title: "Advanced", items: advancedItems },
    { title: "Developer / Integrations", items: developerItems },
    { title: "Account", items: accountItems },
  ];

  const allNavItems = menuSections.flatMap((section) => section.items);

  const currentPlanLabel = getPlanLabel(subscription?.effectivePlan);

  function handleLogout() {
    logout();
    setMobileMenuOpen(false);
    navigate("/");
    toast({ title: "Logged out", description: "See you soon!" });
  }

  const activeNavLabel =
    allNavItems.find((item) =>
      item.end ? location.pathname === item.to : item.to === "/" ? false : location.pathname.startsWith(item.to),
    )?.label ?? "Dashboard";

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

        <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
          {menuSections.map((section, index) => (
            <div key={section.title} className="space-y-4">
              {index > 0 ? <div className="h-px bg-border/70" /> : null}
              <MenuSection title={section.title} items={section.items} />
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden w-11 h-11 shrink-0" aria-label="Open dashboard menu">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[90vw] max-w-sm p-0 flex flex-col duration-300">
                  <SheetHeader className="px-5 py-4 border-b border-border text-left shrink-0">
                    <SheetTitle className="text-base font-semibold tracking-tight">Dashboard Menu</SheetTitle>
                    <SheetDescription className="text-xs">{activeNavLabel}</SheetDescription>
                  </SheetHeader>

                  <div className="px-5 py-3.5 border-b border-border shrink-0">
                    <div className="rounded-lg bg-accent/55 border border-border/80 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Signed in as</p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-foreground">{user?.fullName ?? "Your account"}</p>
                        <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground whitespace-nowrap">
                          {currentPlanLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <nav className="px-3.5 py-3.5 space-y-4 flex-1 overflow-y-auto">
                    {menuSections.map((section, index) => (
                      <div key={section.title} className="space-y-4">
                        {index > 0 ? <div className="h-px bg-border/70" /> : null}
                        <MenuSection
                          title={section.title}
                          items={section.items}
                          onItemClick={() => {
                            setMobileMenuOpen(false);
                          }}
                        />
                      </div>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>

              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold leading-tight">{title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>

            <div className="hidden md:flex md:items-center md:gap-2">
              <ThemeToggle />
              <PlanBadge />
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-8">{children}</main>
        <footer className="border-t border-border bg-card/70 px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground">
            <p>VoxAI Dashboard</p>
            <p>All core features available on desktop and mobile.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
