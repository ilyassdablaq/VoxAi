import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUserSearchResult } from "@/services/admin.service";

interface AdminUserTableProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  users: AdminUserSearchResult[];
  selectedUserId: string | null;
  onSelectUser: (user: AdminUserSearchResult) => void;
  isLoading: boolean;
  isFetching: boolean;
}

export function AdminUserTable({
  query,
  onQueryChange,
  onSearch,
  users,
  selectedUserId,
  onSelectUser,
  isLoading,
  isFetching,
}: AdminUserTableProps) {
  const trimmedQuery = query.trim();

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription>Search by user ID or email to inspect plan access and apply overrides.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="pl-9"
              placeholder="Search by email or user ID"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={trimmedQuery.length < 2 || isFetching} className="sm:w-32">
            {isFetching ? "Searching..." : "Search"}
          </Button>
        </form>

        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Name</TableHead>
                <TableHead className="w-[40%]">Email</TableHead>
                <TableHead className="w-[15%]">Role</TableHead>
                <TableHead className="w-[15%] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={4} className="py-4">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length ? (
                users.map((user) => {
                  const isSelected = selectedUserId === user.id;

                  return (
                    <TableRow key={user.id} data-state={isSelected ? "selected" : undefined}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div>{user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{user.id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant={isSelected ? "secondary" : "outline"} size="sm" onClick={() => onSelectUser(user)}>
                          {isSelected ? "Selected" : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Search for a user to load plan details and override controls.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}