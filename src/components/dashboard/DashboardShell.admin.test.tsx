import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardShell } from "./DashboardShell";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/PlanBadge", () => ({
  PlanBadge: () => <div>PlanBadge</div>,
}));

import { useAuth } from "@/hooks/use-auth";

describe("DashboardShell admin navigation", () => {
  it("shows admin panel item for admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      logout: vi.fn(),
      subscription: null,
      user: { role: "ADMIN", fullName: "Admin User" },
    } as any);

    render(
      <MemoryRouter>
        <DashboardShell title="Dashboard" description="desc">
          <div>content</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
  });

  it("hides admin panel item for non-admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      logout: vi.fn(),
      subscription: null,
      user: { role: "USER", fullName: "Regular User" },
    } as any);

    render(
      <MemoryRouter>
        <DashboardShell title="Dashboard" description="desc">
          <div>content</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
  });
});
