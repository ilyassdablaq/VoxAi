import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Admin from "./Admin";

const { toastMock, adminServiceMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  adminServiceMock: {
    searchUsers: vi.fn(),
    getEffectiveAccess: vi.fn(),
    getOverrideHistory: vi.fn(),
    setPlanOverride: vi.fn(),
    removeOverride: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

    adminServiceMock.getOverrideHistory.mockResolvedValue([]);
    adminServiceMock.setPlanOverride.mockResolvedValue({});
    adminServiceMock.removeOverride.mockResolvedValue(undefined);
  });

  it("calls setPlanOverride for selected user", async () => {
    renderAdminPage();

    fireEvent.change(screen.getByPlaceholderText(/search by user email or user id/i), {
      target: { value: "user" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    const userRow = await screen.findByRole("button", { name: /user one/i });
    fireEvent.click(userRow);

    const setProButton = await screen.findByRole("button", { name: /set pro for user/i });
    fireEvent.click(setProButton);

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

  it("calls removeOverride for selected user", async () => {
    renderAdminPage();

    fireEvent.change(screen.getByPlaceholderText(/search by user email or user id/i), {
      target: { value: "user" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    const userRow = await screen.findByRole("button", { name: /user one/i });
    fireEvent.click(userRow);

    const removeButton = await screen.findByRole("button", { name: /remove override/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(adminServiceMock.removeOverride).toHaveBeenCalledWith("user-1");
    });
  });
});
