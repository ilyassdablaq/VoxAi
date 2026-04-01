-- SLO Tracking table for error budgets
CREATE TABLE slo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
  slo_target DECIMAL(5, 2) NOT NULL,
  current_value DECIMAL(5, 2) NOT NULL,
  error_budget_remaining DECIMAL(5, 2) NOT NULL,
  burn_rate DECIMAL(5, 2) NOT NULL,
  window_start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slo_metrics_tenant ON slo_metrics(tenant_id);
CREATE INDEX idx_slo_metrics_name ON slo_metrics(metric_name);

-- Billing safety: spend tracking and caps
CREATE TABLE spend_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL,
  monthly_budget_cents BIGINT NOT NULL,
  current_month_spend_cents BIGINT DEFAULT 0,
  warning_threshold_percent INT DEFAULT 80,
  hard_limit_enabled BOOLEAN DEFAULT true,
  grace_period_days INT DEFAULT 3,
  last_reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_spend_caps_tenant ON spend_caps(tenant_id);

-- Data lifecycle: retention policies
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL, -- 'logs', 'messages', 'embeddings', 'conversations'
  retention_days INT NOT NULL,
  auto_archive_enabled BOOLEAN DEFAULT false,
  archive_location VARCHAR(255), -- S3 path or similar
  gdpr_compliant BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_retention_policies_tenant ON retention_policies(tenant_id);
CREATE INDEX idx_retention_policies_type ON retention_policies(data_type);

-- API Key security: scoped keys with rotation
CREATE TABLE api_keys_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  key_prefix VARCHAR(10) NOT NULL, -- e.g. 'sk_live_', 'sk_test_'
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  scopes VARCHAR(255) NOT NULL, -- comma-separated: read, write, admin
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_used_ip VARCHAR(45),
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  next_rotation_required_at TIMESTAMP WITH TIME ZONE,
  rotation_in_progress BOOLEAN DEFAULT false,
  name VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_v2_tenant ON api_keys_v2(tenant_id);
CREATE INDEX idx_api_keys_v2_hash ON api_keys_v2(key_hash);
CREATE INDEX idx_api_keys_v2_prefix ON api_keys_v2(key_prefix);

-- API Key leak detection
CREATE TABLE leaked_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys_v2(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  detection_source VARCHAR(100), -- 'scanner', 'user_report', 'github_scanning'
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255),
  severity VARCHAR(20), -- 'low', 'medium', 'high'
  action_taken VARCHAR(50), -- 'revoked', 'notified', 'investigating'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leaked_api_keys_tenant ON leaked_api_keys(tenant_id);

-- Webhook event store for replay and audit
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'conversation.created', 'message.received', etc
  payload JSONB NOT NULL,
  signature_version INT DEFAULT 1,
  delivery_attempts INT DEFAULT 0,
  last_delivery_attempt_at TIMESTAMP WITH TIME ZONE,
  last_delivery_status VARCHAR(50), -- 'success', 'failed', 'pending'
  delivered_at TIMESTAMP WITH TIME ZONE,
  replay_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_tenant ON webhook_events(tenant_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);

-- Webhook delivery history for dashboard
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  endpoint_url VARCHAR(512) NOT NULL,
  http_status INT,
  response_time_ms INT,
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(webhook_event_id);
CREATE INDEX idx_webhook_deliveries_tenant ON webhook_deliveries(tenant_id);

-- AI regression testing: golden datasets and evaluations
CREATE TABLE golden_test_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INT DEFAULT 1,
  input_text TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  metadata JSONB, -- tags, category, model_version, etc
  created_by UUID REFERENCES "User"(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_golden_test_sets_name ON golden_test_sets(name);
CREATE INDEX idx_golden_test_sets_version ON golden_test_sets(version);

-- Offline evaluations for each model/prompt change
CREATE TABLE offline_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  golden_test_set_id UUID NOT NULL REFERENCES golden_test_sets(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  prompt_version INT NOT NULL,
  chunking_strategy VARCHAR(100),
  actual_output TEXT NOT NULL,
  similarity_score DECIMAL(5, 4), -- 0-1
  quality_score DECIMAL(5, 4), -- 0-1
  latency_ms INT,
  tokens_used INT,
  evaluation_status VARCHAR(50), -- 'passed', 'failed', 'degraded'
  release_gate_result VARCHAR(50), -- 'approved', 'blocked', 'manual_review'
  evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_offline_evaluations_model ON offline_evaluations(model_name);
CREATE INDEX idx_offline_evaluations_status ON offline_evaluations(evaluation_status);
CREATE INDEX idx_offline_evaluations_release_gate ON offline_evaluations(release_gate_result);

-- Release gate configuration and history
CREATE TABLE release_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_name VARCHAR(100) NOT NULL UNIQUE,
  min_similarity_score DECIMAL(5, 4) NOT NULL DEFAULT 0.85,
  min_quality_score DECIMAL(5, 4) NOT NULL DEFAULT 0.80,
  max_latency_ms INT NOT NULL DEFAULT 3000,
  token_efficiency_target DECIMAL(5, 4) NOT NULL DEFAULT 0.95,
  override_admin_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  override_reason TEXT,
  override_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batch deletion queue for GDPR and lifecycle management
CREATE TABLE data_deletion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL, -- 'user', 'messages', 'logs', 'embeddings'
  entity_id VARCHAR(255),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_deletion_queue_tenant ON data_deletion_queue(tenant_id);
CREATE INDEX idx_data_deletion_queue_status ON data_deletion_queue(status);
