// k6 run --vus 50 --duration 2m \
//   -e BASE_URL=https://api.voxai.io \
//   -e JWT=eyJ... \
//   load-tests/rag-retrieval.k6.js
//
// Misst: P50/P95/P99 Latenz, Throughput, Error-Rate für authentifizierte
// Conversation-Requests inkl. RAG-Retrieval. Failt CI wenn P95 > 1500ms oder Error-Rate > 1%.

import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const JWT = __ENV.JWT;
if (!JWT) throw new Error("JWT env var required");

const ragLatency = new Trend("rag_text_turn_ms", true);
const wsLatency = new Trend("ws_first_token_ms", true);
const errorRate = new Rate("errors");
const tokensCounter = new Counter("tokens_total");

export const options = {
  scenarios: {
    smoke_rest: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      exec: "smokeRest",
    },
    sustained_rest: {
      executor: "ramping-vus",
      startTime: "30s",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 30 },
        { duration: "2m", target: 30 },
        { duration: "30s", target: 0 },
      ],
      exec: "sustainedRest",
    },
    spike_rest: {
      executor: "ramping-arrival-rate",
      startTime: "4m",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 5 },
      ],
      exec: "smokeRest",
    },
  },
  thresholds: {
    rag_text_turn_ms: ["p(95)<1500", "p(99)<3000"],
    http_req_failed: ["rate<0.01"],
    errors: ["rate<0.01"],
  },
};

const QUERIES = [
  "What is our refund policy?",
  "How do I integrate the voice API?",
  "Show me the pricing for the enterprise tier.",
  "Explain RAG retrieval in our system.",
  "What languages are supported?",
];

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${JWT}`,
};

function getOrCreateConversationId() {
  const res = http.post(`${BASE_URL}/api/conversations`, JSON.stringify({ language: "en" }), {
    headers,
    tags: { name: "create_conversation" },
  });
  check(res, { "conversation created": (r) => r.status === 201 });
  return res.json("id");
}

export function smokeRest() {
  const start = Date.now();
  const conversationId = getOrCreateConversationId();
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const res = http.post(
    `${BASE_URL}/api/conversations/${conversationId}/messages`,
    JSON.stringify({ text: query, language: "en" }),
    { headers, tags: { name: "post_message" }, timeout: "20s" },
  );
  ragLatency.add(Date.now() - start);

  const ok = check(res, {
    "200/201": (r) => r.status === 200 || r.status === 201,
    "has body": (r) => (r.body ?? "").length > 10,
  });
  errorRate.add(!ok);

  const tokens = res.json("tokenCount");
  if (typeof tokens === "number") tokensCounter.add(tokens);
  sleep(1 + Math.random());
}

export function sustainedRest() {
  smokeRest();
}

export function wsTurn() {
  const conversationId = getOrCreateConversationId();
  const url = `${BASE_URL.replace(/^http/, "ws")}/ws/conversations/${conversationId}?token=${JWT}`;

  const start = Date.now();
  const res = ws.connect(url, { tags: { name: "ws_conversation" } }, (socket) => {
    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "text_message", data: "Hello bot", language: "en" }));
    });
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "assistant_delta" || msg.type === "assistant_response") {
        wsLatency.add(Date.now() - start);
        socket.close();
      }
    });
    socket.setTimeout(() => socket.close(), 15000);
  });
  check(res, { "ws 101": (r) => r && r.status === 101 });
}
