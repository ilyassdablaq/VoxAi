import { FormEvent, memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { conversationService, ConversationMessage, ConversationSocketEvent } from "@/services/conversation.service";

type ConnectionState = "connecting" | "connected" | "disconnected";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  ar: "ar-SA",
};

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
}

const ChatBubble = memo(function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "USER";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%] space-y-1">
        <div
          className={`rounded-xl px-4 py-2 text-sm ${
            isUser ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
        <p className={`text-[11px] text-muted-foreground ${isUser ? "text-right" : "text-left"}`}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
});

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function mapApiMessage(message: ConversationMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function upsertMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const exists = messages.some((message) => message.id === incoming.id);
  if (exists) {
    return messages.map((message) => (message.id === incoming.id ? incoming : message));
  }
  return [...messages, incoming];
}

export default function ConversationChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamedAssistantText, setStreamedAssistantText] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [selectedLanguage, setSelectedLanguage] = useState(
    (navigator.language || "en").split("-")[0].toLowerCase(),
  );
  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [isAwaitingAssistantResponse, setIsAwaitingAssistantResponse] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const streamedAssistantRef = useRef("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialAutoScrollDoneRef = useRef(false);

  const {
    data: initialMessages,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["conversation-messages", id],
    queryFn: () => conversationService.getMessages(id as string),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (initialMessages) {
      setChatMessages(initialMessages.map(mapApiMessage));
    }
  }, [initialMessages]);

  useEffect(() => {
    streamedAssistantRef.current = streamedAssistantText;
  }, [streamedAssistantText]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANGUAGE_LOCALE_MAP[selectedLanguage] ?? "en-US";
    }
  }, [selectedLanguage]);

  useEffect(() => {
    const recognitionCtor = (
      window as typeof window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
      }
    ).SpeechRecognition ??
      (
        window as typeof window & {
          SpeechRecognition?: BrowserSpeechRecognitionConstructor;
          webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;

    if (!recognitionCtor) {
      setSpeechRecognitionSupported(false);
      return;
    }

    setSpeechRecognitionSupported(true);
    const recognition = new recognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = LANGUAGE_LOCALE_MAP[selectedLanguage] ?? "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript) {
        setInputValue(transcript);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      toast({
        title: "Microphone error",
        description: event.error === "not-allowed" ? "Microphone access denied." : "Voice capture failed.",
        variant: "destructive",
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [selectedLanguage, toast]);

  useEffect(() => {
    if (!id) {
      return;
    }

    shouldReconnectRef.current = true;

    const connectSocket = () => {
      let socket: WebSocket;
      try {
        socket = conversationService.createSocket(id);
      } catch (error) {
        setConnectionState("disconnected");
        toast({
          title: "Connection failed",
          description: error instanceof Error ? error.message : "Could not open chat connection.",
          variant: "destructive",
        });
        return;
      }

      socketRef.current = socket;
      setConnectionState("connecting");

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionState("connected");
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as ConversationSocketEvent;

          if (payload.type === "assistant_delta") {
            setStreamedAssistantText((current) => current + payload.data.token);
            return;
          }

          if (payload.type === "assistant_response") {
            setChatMessages((current) =>
              upsertMessage(current, {
                id: payload.data.id ?? `assistant-${Date.now()}`,
                role: "ASSISTANT",
                content: payload.data.text,
                createdAt: payload.data.createdAt ?? new Date().toISOString(),
              }),
            );
            setIsAwaitingAssistantResponse(false);
            setStreamedAssistantText("");
            return;
          }

          if (payload.type === "error") {
            if (streamedAssistantRef.current.trim()) {
              setChatMessages((current) =>
                upsertMessage(current, {
                  id: `assistant-fallback-${Date.now()}`,
                  role: "ASSISTANT",
                  content: streamedAssistantRef.current,
                  createdAt: new Date().toISOString(),
                }),
              );
              setStreamedAssistantText("");
            }
            setIsAwaitingAssistantResponse(false);
            toast({
              title: "Chat error",
              description: payload.error.message,
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "Chat error",
            description: "Received an invalid message from server.",
            variant: "destructive",
          });
        }
      };

      socket.onerror = () => {
        setConnectionState("disconnected");
      };

      socket.onclose = () => {
        setConnectionState("disconnected");
        setIsAwaitingAssistantResponse(false);
        if (!shouldReconnectRef.current) {
          return;
        }

        const attempts = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempts;
        const delayMs = Math.min(1000 * 2 ** Math.min(attempts, 4), 10000);

        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectSocket();
        }, delayMs);
      };
    };

    connectSocket();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [id, toast]);

  useEffect(() => {
    const behavior = initialAutoScrollDoneRef.current ? "smooth" : "auto";
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    initialAutoScrollDoneRef.current = true;
  }, [chatMessages, streamedAssistantText]);

  const connectionLabel = useMemo(() => {
    if (connectionState === "connected") {
      return "Connected";
    }
    if (connectionState === "connecting") {
      return "Connecting...";
    }
    return "Disconnected";
  }, [connectionState]);

  const handleSendMessage = (event: FormEvent) => {
    event.preventDefault();

    const content = inputValue.trim();
    if (!content) {
      return;
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Not connected",
        description: "Please wait for chat connection and try again.",
        variant: "destructive",
      });
      return;
    }

    if (isAwaitingAssistantResponse) {
      return;
    }

    setIsAwaitingAssistantResponse(true);

    setChatMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "USER",
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInputValue("");
    setStreamedAssistantText("");

    socketRef.current.send(
      JSON.stringify({
        type: "text_message",
        data: content,
        language: selectedLanguage,
      }),
    );
  };

  const toggleListening = () => {
    if (!speechRecognitionSupported || !recognitionRef.current) {
      toast({
        title: "Microphone unavailable",
        description: "This browser does not support voice input.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognitionRef.current.start();
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Missing conversation identifier.</p>
          <Button onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              aria-label="Conversation language"
            >
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">{connectionLabel}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-1 min-h-0 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 min-h-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h1 className="text-lg font-semibold">Conversation</h1>
            <p className="text-xs text-muted-foreground">ID: {id}</p>
          </div>

          <div className="chat-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth p-4 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-2/3" />
                  </div>
                ))}
              </div>
            ) : null}

            {isError ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-muted-foreground">Failed to load conversation messages.</p>
                <Button variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            ) : null}

            {!isLoading && !isError && chatMessages.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No messages yet. Start the conversation below.</div>
            ) : null}

            {!isLoading && !isError ? chatMessages.map((message) => <ChatBubble key={message.id} message={message} />) : null}

            {streamedAssistantText ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl rounded-bl-sm px-4 py-2 text-sm bg-secondary text-secondary-foreground">
                  {streamedAssistantText}
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Type your message..."
              aria-label="Chat message"
            />
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              onClick={toggleListening}
              disabled={!speechRecognitionSupported}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button type="submit" disabled={connectionState !== "connected" || !inputValue.trim() || isAwaitingAssistantResponse}>
              {connectionState === "connecting" || isAwaitingAssistantResponse ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
