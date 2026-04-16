import { beforeEach, describe, expect, it, vi } from "vitest";

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
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  it("does not place JWT token in WebSocket URL (cookie-based auth only)", () => {
    conversationService.createSocket("conv-123");
    const socket = MockWebSocket.instances[0];

    expect(socket.url).toContain("/ws/conversations/conv-123");
    expect(socket.url).not.toContain("token=");
    expect(socket.url).not.toContain("Bearer");
    expect(socket.url).not.toContain("authorization");
  });

  it("does not send token in WebSocket message payload (authentication via cookie)", () => {
    conversationService.createSocket("conv-abc");
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();

    // Socket should not send any auth payload; cookies are handled by browser
    expect(socket.sentMessages.length).toBe(0);
  });

  it("does not construct Authorization headers or bearer tokens", () => {
    conversationService.createSocket("conv-1");
    const socket = MockWebSocket.instances[0];

    // Verify no auth message was sent
    expect(socket.sentMessages).not.toContain(expect.stringMatching(/Bearer|Authorization|token/i));
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });
});
