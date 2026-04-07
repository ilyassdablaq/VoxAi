import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminRoute } from "./AdminRoute";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";

describe("AdminRoute", () => {
  it("renders children for admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      user: { role: "ADMIN" },
    } as any);

    render(
      <BrowserRouter>
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      </BrowserRouter>,
    );

    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });

  it("does not render children for normal users", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      user: { role: "USER" },
    } as any);

    render(
      <BrowserRouter>
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      </BrowserRouter>,
    );

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });
});
