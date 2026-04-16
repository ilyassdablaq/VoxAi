import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Plus, Mic, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { conversationService, ConversationSummary } from "@/services/conversation.service";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [newConversationLanguage, setNewConversationLanguage] = useState(
    (navigator.language || "en").split("-")[0].toLowerCase(),
  );
  const [openingConversationId, setOpeningConversationId] = useState<string | null>(null);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    if (!paymentState) {
      return;
    }

    if (paymentState === "success") {
      toast({
        title: "Plan upgraded successfully",
        description: "Your paid subscription is now active.",
      });
      void queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
    }

    navigate("/dashboard", { replace: true });
  }, [searchParams, toast, navigate, queryClient]);

  const { data: conversations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => conversationService.listConversations(1, 100),
  });

  const createConversationMutation = useMutation({
    mutationFn: (title: string) =>
      conversationService.createConversation({
        title: title || "New Conversation",
        language: newConversationLanguage,
      }),
    onSuccess: (conversation) => {
      setNewTitle("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Success",
        description: "Conversation created!",
      });
      navigate(`/conversation/${conversation.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  const renameConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => conversationService.renameConversation(id, title),
    onSuccess: () => {
      setRenameConversationId(null);
      setRenameTitle("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Conversation renamed",
        description: "Title updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "Could not rename conversation",
        variant: "destructive",
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => conversationService.deleteConversation(id),
    onSuccess: () => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Conversation deleted",
        description: "The conversation was removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete conversation",
        variant: "destructive",
      });
    },
  });

  const handleCreateConversation = () => {
    createConversationMutation.mutate(newTitle.trim());
  };

  const handleOpenConversation = (conversationId: string) => {
    setOpeningConversationId(conversationId);
    navigate(`/conversation/${conversationId}`);
  };

  const startRenameConversation = (conversation: ConversationSummary) => {
    setRenameConversationId(conversation.id);
    setRenameTitle(conversation.title ?? "Untitled Conversation");
  };

  const saveRenameConversation = (conversationId: string) => {
    const normalizedTitle = renameTitle.trim();
    if (!normalizedTitle) {
      toast({
        title: "Invalid title",
        description: "Please enter a conversation title.",
        variant: "destructive",
      });
      return;
    }
    renameConversationMutation.mutate({ id: conversationId, title: normalizedTitle });
  };

  return (
    <DashboardShell title="Conversations" description="Manage your AI conversations and continue where you left off.">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Create New Conversation */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
            <h3 className="font-semibold text-lg">Create New Conversation</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                placeholder="Enter conversation title (optional)..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                aria-label="Conversation title"
                disabled={createConversationMutation.isPending}
                onKeyDown={(e) => e.key === "Enter" && handleCreateConversation()}
                className="h-11"
              />
              <select
                value={newConversationLanguage}
                onChange={(event) => setNewConversationLanguage(event.target.value)}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                aria-label="Conversation language"
                disabled={createConversationMutation.isPending}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
              <Button onClick={handleCreateConversation} disabled={createConversationMutation.isPending} className="min-h-11">
                <Plus className="w-4 h-4 mr-2" />
                {createConversationMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>

          {/* Conversations List */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Your Conversations</h3>
            {isLoading && (
              <div className="grid gap-4" aria-live="polite" aria-busy="true">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="bg-card border border-border rounded-lg p-6 space-y-3">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {isError && (
              <div className="bg-card border border-border rounded-lg p-6 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Unable to load conversations right now.</p>
                <Button variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !isError && conversations.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No conversations yet. Create one to get started!</p>
              </div>
            ) : null}

            {!isLoading && !isError && conversations.length > 0 ? (
              <div className="grid gap-4">
                {conversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleOpenConversation(conv.id)}
                    className="bg-card border border-border rounded-lg p-4 sm:p-6 hover:border-primary/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {renameConversationId === conv.id ? (
                          <div className="flex items-center gap-2 max-w-xl" onClick={(event) => event.stopPropagation()}>
                            <Input
                              value={renameTitle}
                              onChange={(event) => setRenameTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveRenameConversation(conv.id);
                                }
                                if (event.key === "Escape") {
                                  setRenameConversationId(null);
                                  setRenameTitle("");
                                }
                              }}
                              disabled={renameConversationMutation.isPending}
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => saveRenameConversation(conv.id)}
                              disabled={renameConversationMutation.isPending}
                              aria-label="Save title"
                            >
                              {renameConversationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setRenameConversationId(null);
                                setRenameTitle("");
                              }}
                              aria-label="Cancel rename"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {conv.title || "Untitled Conversation"}
                          </h4>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(conv.createdAt).toLocaleDateString()} • {conv.language.toUpperCase()} • {conv.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:ml-3" onClick={(event) => event.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startRenameConversation(conv)}
                          disabled={renameConversationMutation.isPending || deleteConversationMutation.isPending}
                          aria-label="Rename conversation"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(conv)}
                          disabled={deleteConversationMutation.isPending}
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenConversation(conv.id)} className="min-h-10 px-4">
                          {openingConversationId === conv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Open"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>
      

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. "{deleteTarget?.title || "Untitled Conversation"}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConversationMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConversationMutation.isPending || !deleteTarget}
              onClick={() => {
                if (deleteTarget) {
                  deleteConversationMutation.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteConversationMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
};

export default Dashboard;
