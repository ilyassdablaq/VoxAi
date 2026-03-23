import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Globe, Loader2, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeService } from "@/services/knowledge.service";

const ACCEPTED_FILE_TYPES = ".pdf,.txt,.json,.xml";

export default function DataSources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDragActive, setIsDragActive] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [structuredTitle, setStructuredTitle] = useState("Product Catalog");
  const [structuredFormat, setStructuredFormat] = useState<"json" | "xml">("json");
  const [structuredContent, setStructuredContent] = useState("{}");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("Idle");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: () => knowledgeService.listDocuments(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0);
      setProcessingStatus("Uploading file...");
      return knowledgeService.uploadFile(file, (progress) => {
        setUploadProgress(progress);
        if (progress >= 100) {
          setProcessingStatus("Extracting text and creating embeddings...");
        }
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      setUploadProgress(100);
      setProcessingStatus("Ingestion completed");
      toast({
        title: "Training complete",
        description: `${result.document.title} indexed with ${result.chunksCount} chunks.`,
      });
    },
    onError: (error) => {
      setProcessingStatus("Upload failed");
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload file",
        variant: "destructive",
      });
    },
  });

  const structuredMutation = useMutation({
    mutationFn: () => {
      setProcessingStatus("Parsing structured data and embedding...");
      return knowledgeService.ingestStructured(structuredFormat, structuredTitle, structuredContent);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      setProcessingStatus("Structured ingestion completed");
      toast({
        title: "Structured data indexed",
        description: `${result.document.title} is ready for chatbot retrieval.`,
      });
    },
    onError: (error) => {
      setProcessingStatus("Structured ingestion failed");
      toast({
        title: "Structured import failed",
        description: error instanceof Error ? error.message : "Unable to process structured content",
        variant: "destructive",
      });
    },
  });

  const crawlMutation = useMutation({
    mutationFn: () => {
      setProcessingStatus("Crawling website pages and embedding content...");
      return knowledgeService.ingestUrl(websiteUrl, 4);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      setProcessingStatus("Website ingestion completed");
      toast({
        title: "Website trained",
        description: `${result.document.title} indexed from your website pages.`,
      });
      setWebsiteUrl("");
    },
    onError: (error) => {
      setProcessingStatus("Website crawl failed");
      toast({
        title: "Website crawl failed",
        description: error instanceof Error ? error.message : "Could not crawl this URL",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeService.deleteDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
      toast({ title: "Deleted", description: "Data source removed." });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not remove source",
        variant: "destructive",
      });
    },
  });

  const isBusy = uploadMutation.isPending || structuredMutation.isPending || crawlMutation.isPending;

  const helperText = useMemo(() => {
    if (uploadMutation.isPending) return `${processingStatus} (${uploadProgress}%)`;
    if (structuredMutation.isPending || crawlMutation.isPending) return processingStatus;
    if (processingStatus !== "Idle") return processingStatus;
    return "Upload files, paste JSON/XML, or crawl a website URL to train your chatbot.";
  }, [crawlMutation.isPending, processingStatus, structuredMutation.isPending, uploadMutation.isPending, uploadProgress]);

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    uploadMutation.mutate(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    uploadMutation.mutate(file);
  };

  return (
    <DashboardShell title="Data Sources" description="Train your chatbot with your business data in minutes.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
              className={`rounded-lg border border-dashed p-6 text-center ${isDragActive ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <FileUp className="w-8 h-8 mx-auto text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Drag and drop PDF, TXT, JSON, or XML files here.</p>
              <label className="mt-3 inline-block">
                <Input
                  className="hidden"
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileInput}
                  disabled={isBusy}
                />
                <Button type="button" variant="outline" disabled={isBusy}>
                  Choose file
                </Button>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Supported formats: PDF, text files, JSON, XML.</p>
            {uploadMutation.isPending ? (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground">{processingStatus}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Train from website URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="https://your-business.com"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              disabled={isBusy}
            />
            <Button
              onClick={() => crawlMutation.mutate()}
              disabled={!websiteUrl.trim() || isBusy}
              className="w-full"
            >
              {crawlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
              Crawl and train chatbot
            </Button>
            <p className="text-xs text-muted-foreground">We crawl key pages on the same domain and index text automatically.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Structured data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Data source title"
              value={structuredTitle}
              onChange={(event) => setStructuredTitle(event.target.value)}
              disabled={isBusy}
            />
            <select
              value={structuredFormat}
              onChange={(event) => setStructuredFormat(event.target.value as "json" | "xml")}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              disabled={isBusy}
            >
              <option value="json">JSON</option>
              <option value="xml">XML</option>
            </select>
            <Textarea
              rows={8}
              value={structuredContent}
              onChange={(event) => setStructuredContent(event.target.value)}
              disabled={isBusy}
              className="font-mono text-xs"
            />
            <Button
              onClick={() => structuredMutation.mutate()}
              disabled={!structuredTitle.trim() || !structuredContent.trim() || isBusy}
              className="w-full"
            >
              {structuredMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Parse and train
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{helperText}</p>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading sources...</p> : null}
            {!isLoading && documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources yet. Upload one to start training.</p>
            ) : null}
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-md border border-border p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc._count.chunks} chunks • {new Date(doc.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete source"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
