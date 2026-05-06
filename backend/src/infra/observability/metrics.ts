/**
 * Lightweight Prometheus-compatible metrics exposition without `prom-client` dep.
 * If you add `prom-client`, replace this with the canonical implementation.
 *
 * Exposes counters / histograms / gauges in plain-text format on /metrics.
 */

type LabelMap = Record<string, string | number>;

interface Counter {
  type: "counter";
  help: string;
  values: Map<string, number>;
}

interface Histogram {
  type: "histogram";
  help: string;
  buckets: number[];
  values: Map<string, { counts: number[]; sum: number; total: number }>;
}

interface Gauge {
  type: "gauge";
  help: string;
  values: Map<string, number>;
}

type Metric = Counter | Histogram | Gauge;

const registry = new Map<string, Metric>();

function labelKey(labels: LabelMap = {}): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join(",");
}

export function counter(name: string, help: string) {
  let m = registry.get(name) as Counter | undefined;
  if (!m) {
    m = { type: "counter", help, values: new Map() };
    registry.set(name, m);
  }
  return {
    inc(value = 1, labels: LabelMap = {}) {
      const key = labelKey(labels);
      m!.values.set(key, (m!.values.get(key) ?? 0) + value);
    },
  };
}

export function gauge(name: string, help: string) {
  let m = registry.get(name) as Gauge | undefined;
  if (!m) {
    m = { type: "gauge", help, values: new Map() };
    registry.set(name, m);
  }
  return {
    set(value: number, labels: LabelMap = {}) {
      m!.values.set(labelKey(labels), value);
    },
  };
}

export function histogram(name: string, help: string, buckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) {
  let m = registry.get(name) as Histogram | undefined;
  if (!m) {
    m = { type: "histogram", help, buckets, values: new Map() };
    registry.set(name, m);
  }
  return {
    observe(value: number, labels: LabelMap = {}) {
      const key = labelKey(labels);
      let entry = m!.values.get(key);
      if (!entry) {
        entry = { counts: new Array(buckets.length).fill(0), sum: 0, total: 0 };
        m!.values.set(key, entry);
      }
      entry.sum += value;
      entry.total += 1;
      for (let i = 0; i < buckets.length; i++) {
        if (value <= buckets[i]) entry.counts[i] += 1;
      }
    },
  };
}

export function renderPrometheus(): string {
  const lines: string[] = [];
  for (const [name, metric] of registry) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} ${metric.type}`);
    if (metric.type === "counter" || metric.type === "gauge") {
      for (const [labelStr, value] of metric.values) {
        lines.push(`${name}${labelStr ? `{${labelStr}}` : ""} ${value}`);
      }
    } else {
      for (const [labelStr, entry] of metric.values) {
        for (let i = 0; i < metric.buckets.length; i++) {
          const le = `le="${metric.buckets[i]}"`;
          const labels = labelStr ? `${labelStr},${le}` : le;
          lines.push(`${name}_bucket{${labels}} ${entry.counts[i]}`);
        }
        const inf = labelStr ? `${labelStr},le="+Inf"` : `le="+Inf"`;
        lines.push(`${name}_bucket{${inf}} ${entry.total}`);
        lines.push(`${name}_sum${labelStr ? `{${labelStr}}` : ""} ${entry.sum}`);
        lines.push(`${name}_count${labelStr ? `{${labelStr}}` : ""} ${entry.total}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

// Pre-register hot metrics (call sites import these directly)
export const httpRequestDuration = histogram(
  "http_request_duration_ms",
  "HTTP request latency in ms by method/route/status",
  [10, 25, 50, 100, 200, 500, 1000, 2500, 5000, 10000, 30000],
);
export const httpRequestsTotal = counter("http_requests_total", "Total HTTP requests");
export const ragRetrievalDuration = histogram("rag_retrieval_duration_ms", "RAG retrieval latency");
export const ragRetrievalCacheHits = counter("rag_retrieval_cache_hits_total", "RAG retrieval cache hit/miss");
export const llmRequestDuration = histogram("llm_request_duration_ms", "LLM call latency", [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]);
export const llmTokensTotal = counter("llm_tokens_total", "LLM tokens consumed by user/model/kind");
export const wsActiveConnections = gauge("ws_active_connections", "Active WS connections");
export const queueJobsTotal = counter("queue_jobs_total", "BullMQ jobs by queue/state");
export const rateLimitHits = counter("rate_limit_hits_total", "Rate-limit decisions by plan/result");
