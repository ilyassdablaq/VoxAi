import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConversationChat from "./ConversationChat";

const { toastMock, conversationServiceMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  conversationServiceMock: {
    getMessages: vi.fn(),
    createSocket: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/conversation.service", () => ({
  conversationService: conversationServiceMock,
}));

vi.mock("@/lib/product-analytics", () => ({
  trackEvent: vi.fn(),
}));

function createFakeSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  } as unknown as WebSocket;
}

function renderConversation(path = "/conversation/convo-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/conversation/:id" element={<ConversationChat />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConversationChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    conversationServiceMock.createSocket.mockReturnValue(createFakeSocket());
  });

  it("renders fetched conversation messages", async () => {
    conversationServiceMock.getMessages.mockResolvedValue([
      {
        id: "m-1",
        role: "ASSISTANT",
        content: "Welcome to VoxAI",
        createdAt: new Date().toISOString(),
      },
    ]);

    renderConversation();

    expect(await screen.findByText("Welcome to VoxAI")).toBeInTheDocument();
  });

  it("shows an error state when initial messages fail to load", async () => {
    conversationServiceMock.getMessages.mockRejectedValue(new Error("network error"));

    renderConversation();

    expect(await screen.findByText(/failed to load conversation messages/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
