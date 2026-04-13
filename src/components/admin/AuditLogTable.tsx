import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminAuditLogItem } from "@/services/admin.service";

interface AuditLogTableProps {
  items: AdminAuditLogItem[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function formatAction(action: string) {
  if (action.endsWith(".set")) {
    return "Set override";
  }

  if (action.endsWith(".remove")) {
    return "Remove override";
  }

  return action;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function AuditLogTable({ items, isLoading, total, page, pageSize, onPageChange }: AuditLogTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Audit Logs</CardTitle>
            <CardDescription>Recent override actions with pagination for quick review.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin ID</TableHead>
                <TableHead>Target User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5} className="py-4">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.adminId ?? "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.targetUserId ?? "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant={item.action.endsWith(".remove") ? "outline" : "default"}>{formatAction(item.action)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatTimestamp(item.timestamp)}</TableCell>
                    <TableCell className="max-w-[24rem] text-sm text-muted-foreground">{item.reason || "No reason provided"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No admin actions found yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {items.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)} of {total} actions
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || isLoading}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
              Page {page} of {totalPages}
            </div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || isLoading}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}