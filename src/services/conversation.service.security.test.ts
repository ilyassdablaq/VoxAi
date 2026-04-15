import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth.service", () => ({
  authService: {
    getAccessToken: vi.fn(),
  },
}));

import { authService } from "@/services/auth.service";
import { conversationService } from "./conversation.service";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  sentMessages: string[] = [];
  private listeners = new Map<string, Array<() => void>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(eventName: string, listener: () => void) {
    const existing = this.listeners.get(eventName) || [];
    existing.push(listener);
    this.listeners.set(eventName, existing);
  }

  send(payload: string) {
    this.sentMessages.push(payload);
  }

  emitOpen() {
    const openListeners = this.listeners.get("open") || [];
    for (const listener of openListeners) {
      listener();
    }
  }
}

describe("conversationService WebSocket security", () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.mocked(authService.getAccessToken).mockReturnValue("test-jwt-token");
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  it("does not place JWT token in WebSocket URL", () => {
    conversationService.createSocket("conv-123");
    const socket = MockWebSocket.instances[0];

    expect(socket.url).toContain("/ws/conversations/conv-123");
    expect(socket.url).not.toContain("token=");
    expect(socket.url).not.toContain("test-jwt-token");
  });

  it("sends authentication payload after socket opens", () => {
    conversationService.createSocket("conv-abc");
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();

    expect(socket.sentMessages).toHaveLength(1);
    expect(JSON.parse(socket.sentMessages[0])).toEqual({
      type: "auth",
      data: "authenticate",
      token: "test-jwt-token",
    });
  });

  it("throws when no token is available", () => {
    vi.mocked(authService.getAccessToken).mockReturnValue(null);

    expect(() => conversationService.createSocket("conv-1")).toThrow(
      "You must be signed in to open this conversation.",
    );
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });
});
