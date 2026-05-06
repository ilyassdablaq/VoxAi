/**
 * WS-Broker: Cross-Instance Message-Fanout via Redis Pub/Sub.
 *
 * Problem: Jede Backend-Instanz hält nur ihre lokalen Sockets. Ein Server-
 * seitiges Event (z.B. "conversation.deleted" aus Worker) kommt nur an Sockets
 * an, die *zufällig* auf dieser Instanz hängen.
 *
 * Lösung: Jede Instanz subscribed auf ein gemeinsames Pattern. Lokale
 * Sockets werden in einer prozess-internen Map gehalten. Beim Publish wird
 * über Redis fan-out gemacht.
 *
 * Channels:
 *   ws:conv:{conversationId}   — Conversation-scoped (assistant_response, error)
 *   ws:user:{userId}           — User-scoped (subscription updates, billing alerts)
 *   ws:broadcast               — System-weite Notifications (maintenance, feature flags)
 */

import type { WebSocket } from "ws";
import { redisPublisher, redisSubscriber } from "../cache/redis.js";
import { logger } from "../../config/logger.js";
import { wsActiveConnections } from "../observability/metrics.js";

type Topic = "conv" | "user" | "broadcast";
type ChannelKey = string;

interface SocketEntry {
  socket: WebSocket;
  userId: string;
  conversationId?: string;
  attachedAt: number;
}

// Lokales Registry: channel → set of socket-entries
const localSubscriptions = new Map<ChannelKey, Set<SocketEntry>>();

let initialized = false;
let connectionCount = 0;

function channelKey(topic: Topic, id?: string): ChannelKey {
  return id ? `ws:${topic}:${id}` : `ws:${topic}`;
}

function safeSend(socket: WebSocket, message: string): void {
  try {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  } catch (error) {
    logger.warn({ error: (error as Error).message }, "WS send failed");
  }
}

function dispatch(channel: ChannelKey, payload: string): void {
  const entries = localSubscriptions.get(channel);
  if (!entries || entries.size === 0) return;
  for (const entry of entries) {
    safeSend(entry.socket, payload);
  }
}

/**
 * Initialize the global subscriber. Call once in `bootstrap()` before WS gateway.
 */
export async function initializeWsBroker(): Promise<void> {
  if (initialized) return;
  initialized = true;

  redisSubscriber.on("pmessage", (_pattern, channel, message) => {
    dispatch(channel, message);
  });

  redisSubscriber.on("error", (err) => {
    logger.error({ err: err.message }, "WS broker subscriber error");
  });

  // Connect lazy clients & subscribe to all WS topics
  if (redisSubscriber.status === "wait" || redisSubscriber.status === "end") {
    await redisSubscriber.connect();
  }
  if (redisPublisher.status === "wait" || redisPublisher.status === "end") {
    await redisPublisher.connect();
  }

  await redisSubscriber.psubscribe("ws:conv:*", "ws:user:*", "ws:broadcast");
  logger.info("WS broker initialized (psubscribe ws:conv:*, ws:user:*, ws:broadcast)");
}

/**
 * Register a local socket against the relevant channels.
 * Returns an `unregister()` cleanup function.
 */
export function registerSocket(input: {
  socket: WebSocket;
  userId: string;
  conversationId?: string;
}): () => void {
  const entry: SocketEntry = {
    socket: input.socket,
    userId: input.userId,
    conversationId: input.conversationId,
    attachedAt: Date.now(),
  };

  const channels: ChannelKey[] = [channelKey("user", input.userId), channelKey("broadcast")];
  if (input.conversationId) {
    channels.push(channelKey("conv", input.conversationId));
  }

  for (const ch of channels) {
    let set = localSubscriptions.get(ch);
    if (!set) {
      set = new Set();
      localSubscriptions.set(ch, set);
    }
    set.add(entry);
  }

  connectionCount += 1;
  wsActiveConnections.set(connectionCount);

  return () => {
    for (const ch of channels) {
      const set = localSubscriptions.get(ch);
      if (set) {
        set.delete(entry);
        if (set.size === 0) localSubscriptions.delete(ch);
      }
    }
    connectionCount = Math.max(0, connectionCount - 1);
    wsActiveConnections.set(connectionCount);
  };
}

/**
 * Publish to all instances. Falls Redis nicht verfügbar ist, fallen Pakete
 * auf den lokalen Dispatch zurück (best-effort).
 */
export async function publishToConversation(conversationId: string, payload: unknown): Promise<void> {
  const channel = channelKey("conv", conversationId);
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  try {
    await redisPublisher.publish(channel, message);
  } catch (error) {
    logger.warn({ error: (error as Error).message, channel }, "WS publish failed; using local fallback");
    dispatch(channel, message);
  }
}

export async function publishToUser(userId: string, payload: unknown): Promise<void> {
  const channel = channelKey("user", userId);
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  try {
    await redisPublisher.publish(channel, message);
  } catch {
    dispatch(channel, message);
  }
}

export async function publishBroadcast(payload: unknown): Promise<void> {
  const channel = channelKey("broadcast");
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  try {
    await redisPublisher.publish(channel, message);
  } catch {
    dispatch(channel, message);
  }
}

/**
 * Send to *only* the local socket (e.g. directly via the request-handler).
 * Use this for the "echo back to caller" path where you don't need fanout.
 */
export function sendLocal(socket: WebSocket, payload: unknown): void {
  safeSend(socket, typeof payload === "string" ? payload : JSON.stringify(payload));
}

export function getLocalConnectionCount(): number {
  return connectionCount;
}
