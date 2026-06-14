import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Trash2, AlertTriangle, XCircle, Globe } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  ticketService,
} from "@/services/ticket.service";

const CATEGORIES: Array<{ value: TicketCategory; label: string }> = [
  { value: "technical", label: "Technisches Problem" },
  { value: "voice_quality", label: "Sprachqualität / KI-Antworten" },
  { value: "integration", label: "Integration / Webhook" },
  { value: "billing", label: "Abrechnung / Abo" },
  { value: "account", label: "Account / Login" },
  { value: "other", label: "Sonstiges" },
];

const PRIORITIES: Array<{ value: TicketPriority; label: string }> = [
  { value: "LOW", label: "Niedrig" },
  { value: "MEDIUM", label: "Mittel" },
  { value: "HIGH", label: "Hoch" },
  { value: "URGENT", label: "Dringend" },
];

const STATUS_META: Record<TicketStatus, { label: string; className: string; icon: typeof Clock }> = {
  OPEN: {
    label: "Offen",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Bearbeitung",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    icon: AlertTriangle,
  },
  RESOLVED: {
    label: "Gelöst",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Geschlossen",
    className: "bg-muted text-muted-foreground",
    icon: XCircle,
  },
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function categoryLabel(value: TicketCategory): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function isOpen(ticket: SupportTicket): boolean {
  return ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";
}

export default function Support() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => ticketService.listTickets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ticketService.deleteTicket(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({ title: "Ticket gelöscht" });
    },
    onError: (error) => {
      toast({
        title: "Löschen fehlgeschlagen",
        description: error instanceof Error ? error.message : "Bitte versuche es erneut.",
        variant: "destructive",
      });
    },
  });

  const tickets: SupportTicket[] = ticketsQuery.data ?? [];
  const sortedTickets = [...tickets].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const isBusy = deleteMutation.isPending;

  return (
    <DashboardShell
      title="IT Support"
      description="Support-Tickets, die deine Website-Besucher über das Chat-Widget einreichen."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Support-Tickets ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Lade Tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Tickets. Sobald ein Besucher über das Widget ein Ticket einreicht, erscheint es hier.
              Aktiviere dafür „IT Support" im Widget unter Integrations.
            </p>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
              {sortedTickets.map((ticket) => {
                const statusMeta = STATUS_META[ticket.status];
                const StatusIcon = statusMeta.icon;
                return (
                  <div key={ticket.id} className="rounded-md border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE[ticket.priority]}`}
                          >
                            {PRIORITIES.find((p) => p.value === ticket.priority)?.label ?? ticket.priority}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {ticket.visitorName ? (
                            <span className="text-xs text-muted-foreground font-medium">{ticket.visitorName}</span>
                          ) : null}
                          {ticket.visitorEmail ? (
                            <a href={`mailto:${ticket.visitorEmail}`} className="text-xs text-primary hover:underline">
                              {ticket.visitorEmail}
                            </a>
                          ) : null}
                          <span className="text-[11px] text-muted-foreground">
                            {categoryLabel(ticket.category)} • {formatDate(ticket.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(ticket.id)}
                        disabled={isBusy}
                        title="Ticket löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
