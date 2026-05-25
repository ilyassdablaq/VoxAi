import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, LifeBuoy, Send, Trash2, AlertTriangle, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export default function Support() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => ticketService.listTickets(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      ticketService.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setSubject("");
      setDescription("");
      setCategory("technical");
      setPriority("MEDIUM");
      toast({
        title: "Ticket erstellt",
        description: "Unser Support-Team wurde benachrichtigt und meldet sich zeitnah.",
      });
    },
    onError: (error) => {
      toast({
        title: "Ticket konnte nicht erstellt werden",
        description: error instanceof Error ? error.message : "Bitte versuche es erneut.",
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => ticketService.updateTicket(id, { status: "CLOSED" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast({ title: "Ticket geschlossen" });
    },
    onError: (error) => {
      toast({
        title: "Aktion fehlgeschlagen",
        description: error instanceof Error ? error.message : "Bitte versuche es erneut.",
        variant: "destructive",
      });
    },
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

  const isBusy = createMutation.isPending || closeMutation.isPending || deleteMutation.isPending;
  const formInvalid = subject.trim().length < 3 || description.trim().length < 10;

  const tickets: SupportTicket[] = ticketsQuery.data ?? [];
  const openTickets = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const resolvedTickets = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  return (
    <DashboardShell
      title="IT Support"
      description="Beschreibe dein Anliegen oder eine Beschwerde – wir erstellen automatisch ein Support-Ticket."
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              Neues Support-Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Betreff</label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Kurzbeschreibung des Problems"
                disabled={isBusy}
                maxLength={140}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kategorie</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TicketCategory)}
                  disabled={isBusy}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priorität</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TicketPriority)}
                  disabled={isBusy}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Anliegen / Beschwerde</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Beschreibe das Problem so detailliert wie möglich. Welche Schritte führen dazu? Welches Verhalten erwartest du?"
                rows={7}
                disabled={isBusy}
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/4000
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={formInvalid || isBusy}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Ticket absenden
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aktive Tickets ({openTickets.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Lade Tickets...</p>
              ) : null}
              {!ticketsQuery.isLoading && openTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine offenen Tickets. Sobald du eines anlegst, erscheint es hier.
                </p>
              ) : null}
              {openTickets.map((ticket) => {
                const statusMeta = STATUS_META[ticket.status];
                const StatusIcon = statusMeta.icon;
                return (
                  <div key={ticket.id} className="rounded-md border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
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
                          <span className="text-[11px] text-muted-foreground">
                            {categoryLabel(ticket.category)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closeMutation.mutate(ticket.id)}
                          disabled={isBusy}
                          title="Ticket schließen"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Schließen
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Erstellt {formatDate(ticket.createdAt)} • ID: {ticket.id.slice(0, 8)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verlauf ({resolvedTickets.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!ticketsQuery.isLoading && resolvedTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Tickets.</p>
              ) : null}
              {resolvedTickets.map((ticket) => {
                const statusMeta = STATUS_META[ticket.status];
                const StatusIcon = statusMeta.icon;
                return (
                  <div key={ticket.id} className="rounded-md border border-border p-3 space-y-2 opacity-90">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${statusMeta.className}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {categoryLabel(ticket.category)} • {formatDate(ticket.updatedAt)}
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
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
