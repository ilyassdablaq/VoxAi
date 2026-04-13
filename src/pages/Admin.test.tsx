import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Admin from "./Admin";

const { toastMock, adminServiceMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  adminServiceMock: {
    searchUsers: vi.fn(),
    getEffectiveAccess: vi.fn(),
    getAuditLogs: vi.fn(),
    setPlanOverride: vi.fn(),
    removeOverride: vi.fn(),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "ADMIN",
    },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/admin.service", () => ({
  adminService: adminServiceMock,
}));

function renderAdminPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    adminServiceMock.searchUsers.mockResolvedValue([
      {
        id: "user-1",
        email: "user@example.com",
        fullName: "User One",
        role: "USER",
      },
    ]);

    adminServiceMock.getEffectiveAccess.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        fullName: "User One",
        role: "USER",
      },
      effectivePlan: {
        type: "FREE",
        key: "free",
        source: "subscription",
      },
      subscriptionPlan: {
        key: "free",
        type: "FREE",
        name: "Free",
        interval: "MONTHLY",
      },
      override: null,
    });

    adminServiceMock.getAuditLogs.mockResolvedValue({ items: [], total: 0 });
    adminServiceMock.setPlanOverride.mockResolvedValue({});
    adminServiceMock.removeOverride.mockResolvedValue(undefined);
  });

  it("searches users and confirms a PRO override", async () => {
    renderAdminPage();

    fireEvent.change(screen.getByPlaceholderText(/search by email or user id/i), {
      target: { value: "user" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    const userRow = await screen.findByRole("button", { name: /select/i });
    fireEvent.click(userRow);

    const setProButton = await screen.findByRole("button", { name: /set pro/i });
    fireEvent.click(setProButton);

    const confirmButton = await screen.findByRole("button", { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(adminServiceMock.setPlanOverride).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          plan: "PRO",
          reason: "Internal QA override",
        }),
      );
    });
  });

  it("confirms removal of an active override", async () => {
    adminServiceMock.getEffectiveAccess.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "user@example.com",
        fullName: "User One",
        role: "USER",
      },
      effectivePlan: {
        type: "PRO",
        key: "pro",
        source: "admin_override",
      },
      subscriptionPlan: {
        key: "free",
        type: "FREE",
        name: "Free",
        interval: "MONTHLY",
      },
      override: {
        plan: "PRO",
        reason: "QA",
        expiresAt: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        createdByAdminId: "admin-1",
        isActive: true,
        isExpired: false,
      },
    });

    renderAdminPage();

    fireEvent.change(screen.getByPlaceholderText(/search by email or user id/i), {
      target: { value: "user" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    const userRow = await screen.findByRole("button", { name: /select/i });
    fireEvent.click(userRow);

    const removeButton = await screen.findByRole("button", { name: /remove override/i });
    fireEvent.click(removeButton);

    const confirmButton = await screen.findByRole("button", { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(adminServiceMock.removeOverride).toHaveBeenCalledWith("user-1");
    });
  });
});