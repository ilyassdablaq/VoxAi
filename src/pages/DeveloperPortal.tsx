import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { developerService } from "@/services/developer.service";

export default function DeveloperPortal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("Production API Key");
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ["developer-keys"],
    queryFn: () => developerService.listApiKeys(),
  });

  const snippetsQuery = useQuery({
    queryKey: ["developer-snippets"],
    queryFn: () => developerService.getSnippets(),
  });

  const createMutation = useMutation({
    mutationFn: () => developerService.createApiKey(newKeyName),
    onSuccess: (result) => {
      setLastGeneratedKey(result.plainTextKey);
      void queryClient.invalidateQueries({ queryKey: ["developer-keys"] });
      toast({ title: "API key created", description: "Copy it now. It will not be shown again." });
    },
    onError: (error) => {
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Unable to create API key",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => developerService.revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["developer-keys"] });
      toast({ title: "Key revoked", description: "API key is now inactive." });
    },
    onError: (error) => {
      toast({
        title: "Revoke failed",
        description: error instanceof Error ? error.message : "Unable to revoke API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const snippets = useMemo(() => snippetsQuery.data, [snippetsQuery.data]);

  return (
    <DashboardShell title="API & SDK Integration" description="Generate API keys and integrate via REST or WebSocket clients.">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} placeholder="Key name" />
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newKeyName.trim()}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Create
              </Button>
            </div>

            {lastGeneratedKey ? (
              <div className="rounded-md border border-border p-3 space-y-2">
                <p className="text-sm font-medium">New API Key (shown once)</p>
                <Textarea rows={3} readOnly value={lastGeneratedKey} className="font-mono text-xs" />
                <Button variant="outline" onClick={() => void copyToClipboard(lastGeneratedKey, "API key")}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Key
                </Button>
              </div>
            ) : null}

            <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
              {keysQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading API keys...</p> : null}
              {keysQuery.data?.map((key) => (
                <div key={key.id} className="rounded-md border border-border p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground">{key.maskedPrefix} • {key.isActive ? "Active" : "Inactive"}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => revokeMutation.mutate(key.id)} disabled={revokeMutation.isPending || !key.isActive}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>REST & WebSocket Snippets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">REST Request</p>
              <Textarea rows={6} readOnly value={snippets?.restExample ?? "Loading..."} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => snippets?.restExample && void copyToClipboard(snippets.restExample, "REST snippet")}>
                <Copy className="w-4 h-4 mr-2" />
                Copy REST
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">JavaScript SDK-style Example</p>
              <Textarea rows={8} readOnly value={snippets?.javascriptExample ?? "Loading..."} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => snippets?.javascriptExample && void copyToClipboard(snippets.javascriptExample, "JavaScript snippet")}>
                <Copy className="w-4 h-4 mr-2" />
                Copy JavaScript
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Python Example</p>
              <Textarea rows={8} readOnly value={snippets?.pythonExample ?? "Loading..."} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => snippets?.pythonExample && void copyToClipboard(snippets.pythonExample, "Python snippet")}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Python
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
