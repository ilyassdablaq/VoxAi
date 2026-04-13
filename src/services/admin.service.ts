import { apiClient } from "@/lib/api-client";

export interface AdminUserSearchResult {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
}

export interface AdminAuditLogItem {
  id: string;
  adminId: string | null;
  targetUserId: string | null;
  action: string;
  reason: string | null;
  timestamp: string;
}

export interface AdminAuditLogResponse {
  items: AdminAuditLogItem[];
  total: number;
}

export interface EffectiveAccessResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: "USER" | "ADMIN";
  };
  effectivePlan: {
    type: "FREE" | "PRO" | "ENTERPRISE";
    key: string;
    source: "subscription" | "admin_override";
  };
  subscriptionPlan: {
    key: string;
    type: "FREE" | "PRO" | "ENTERPRISE";
    name: string;
    interval: "MONTHLY" | "YEARLY";
  } | null;
  override: {
    plan: "FREE" | "PRO" | "ENTERPRISE";
    reason?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    createdByAdminId: string;
    isActive: boolean;
    isExpired: boolean;
  } | null;
}

export interface OverrideHistoryItem {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  reason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
  createdByAdmin: {
    email: string;
    fullName: string;
  } | null;
}

export type SetOverridePayload = Record<string, unknown> & {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  expiresAt?: string;
  reason?: string;
};

export interface AuditLogQueryParams {
  limit?: number;
  offset?: number;
}

export const adminService = {
  searchUsers(query: string, limit = 10): Promise<AdminUserSearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return apiClient.get<AdminUserSearchResult[]>(`/api/admin/users/search?${params.toString()}`);
  },

  getEffectiveAccess(userId: string): Promise<EffectiveAccessResponse> {
    return apiClient.get<EffectiveAccessResponse>(`/api/admin/users/${encodeURIComponent(userId)}/effective-access`);
  },

  setPlanOverride(userId: string, payload: SetOverridePayload) {
    return apiClient.post(`/api/admin/users/${encodeURIComponent(userId)}/subscription/override`, payload);
  },

  removeOverride(userId: string): Promise<void> {
    return apiClient.delete<void>(`/api/admin/users/${encodeURIComponent(userId)}/subscription/override`);
  },

  getOverrideHistory(userId: string, limit = 10): Promise<OverrideHistoryItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    return apiClient.get<OverrideHistoryItem[]>(`/api/admin/users/${encodeURIComponent(userId)}/overrides?${params.toString()}`);
  },

  getAuditLogs(params: AuditLogQueryParams = {}): Promise<AdminAuditLogResponse> {
    const searchParams = new URLSearchParams();

    if (typeof params.limit === "number") {
      searchParams.set("limit", String(params.limit));
    }

    if (typeof params.offset === "number") {
      searchParams.set("offset", String(params.offset));
    }

    const query = searchParams.toString();
    return apiClient.get<AdminAuditLogResponse>(`/api/admin/audit-logs${query ? `?${query}` : ""}`);
  },
};
