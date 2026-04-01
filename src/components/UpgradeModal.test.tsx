import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { UpgradeModal } from "./UpgradeModal";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/services/subscription.service", () => ({
  subscriptionService: {
    listPlans: vi.fn(),
    startUpgrade: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

import { useAuth } from "@/hooks/use-auth";
import { subscriptionService } from "@/services/subscription.service";

describe("UpgradeModal", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOpenChange.mockClear();
    mockOnClose.mockClear();
  });

  it("should render upgrade modal when open", () => {
    vi.mocked(useAuth).mockReturnValue({
      subscription: null,
    } as any);

    render(
      <BrowserRouter>
        <UpgradeModal
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          feature="Advanced Analytics"
          requiredPlan="PRO"
          onClose={mockOnClose}
        />
      </BrowserRouter>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should not render modal when closed", () => {
    vi.mocked(useAuth).mockReturnValue({
      subscription: null,
    } as any);

    const { container } = render(
      <BrowserRouter>
        <UpgradeModal
          isOpen={false}
          onOpenChange={mockOnOpenChange}
          feature="Advanced Analytics"
          requiredPlan="PRO"
          onClose={mockOnClose}
        />
      </BrowserRouter>
    );

    expect(
      container.querySelector('[role="dialog"]')
    ).not.toBeInTheDocument();
  });

  it("should close modal and call callbacks when close button is clicked", async () => {
    vi.mocked(useAuth).mockReturnValue({
      subscription: null,
    } as any);

    render(
      <BrowserRouter>
        <UpgradeModal
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          feature="Advanced Analytics"
          requiredPlan="PRO"
          onClose={mockOnClose}
        />
      </BrowserRouter>
    );

    const closeButtons = screen.getAllByRole("button", { name: /^Close$/ });
    const closeButton = closeButtons.find((button) => button.className.includes("border-input")) ?? closeButtons[0];
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("should handle upgrade click and redirect to checkout", async () => {
    vi.mocked(useAuth).mockReturnValue({
      subscription: null,
    } as any);

    const mockPlans = [
      {
        id: "1",
        key: "pro",
        name: "Pro",
        type: "PRO",
        interval: "MONTHLY",
        priceCents: 9900,
        voiceMinutes: 5000,
        tokenLimit: 100000,
        features: [],
      },
      {
        id: "2",
        key: "pro-annual",
        name: "Pro Annual",
        type: "PRO",
        interval: "ANNUAL",
        priceCents: 99000,
        voiceMinutes: 5000,
        tokenLimit: 100000,
        features: [],
      },
    ];

    const checkoutUrl = "https://checkout.stripe.com/pay/session123";

    vi.mocked(subscriptionService.listPlans).mockResolvedValue(mockPlans);
    vi.mocked(subscriptionService.startUpgrade).mockResolvedValue({
      sessionId: "session123",
      url: checkoutUrl,
      mode: "checkout",
    });

    // Mock window.location.href
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { href: "" } as any;

    render(
      <BrowserRouter>
        <UpgradeModal
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          feature="Advanced Analytics"
          requiredPlan="PRO"
          onClose={mockOnClose}
        />
      </BrowserRouter>
    );

    const upgradeButton = screen.getByRole("button", { name: /upgrade|subscribe/i });
    fireEvent.click(upgradeButton);

    await waitFor(() => {
      expect(subscriptionService.listPlans).toHaveBeenCalled();
      expect(subscriptionService.startUpgrade).toHaveBeenCalledWith("pro");
      expect(window.location.href).toBe(checkoutUrl);
    });

    // Restore window.location
    window.location = originalLocation;
  });

  it("should display the feature name in the modal", () => {
    vi.mocked(useAuth).mockReturnValue({
      subscription: null,
    } as any);

    render(
      <BrowserRouter>
        <UpgradeModal
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          feature="Advanced Analytics"
          requiredPlan="PRO"
          onClose={mockOnClose}
        />
      </BrowserRouter>
    );

    expect(screen.getByText(/Advanced Analytics/i)).toBeInTheDocument();
  });

  it("should prefer monthly billing when available", async () => {
    vi.mocked(useAuth).mockReturnValue({
      subscription: null,
    } as any);

    const mockPlans = [
      {
        id: "2",
        key: "pro-annual",
        name: "Pro Annual",
        type: "PRO",
        interval: "ANNUAL",
        priceCents: 99000,
        voiceMinutes: 5000,
        tokenLimit: 100000,
        features: [],
      },
      {
        id: "1",
        key: "pro",
        name: "Pro",
        type: "PRO",
        interval: "MONTHLY",
        priceCents: 9900,
        voiceMinutes: 5000,
        tokenLimit: 100000,
        features: [],
      },
    ];

    vi.mocked(subscriptionService.listPlans).mockResolvedValue(mockPlans);
    vi.mocked(subscriptionService.startUpgrade).mockResolvedValue({
      sessionId: "session123",
      url: "https://checkout",
      mode: "checkout",
    });

    delete (window as any).location;
    window.location = { href: "" } as any;

    render(
      <BrowserRouter>
        <UpgradeModal
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          feature="Advanced Analytics"
          requiredPlan="PRO"
          onClose={mockOnClose}
        />
      </BrowserRouter>
    );

    const upgradeButton = screen.getByRole("button", { name: /upgrade|subscribe/i });
    fireEvent.click(upgradeButton);

    await waitFor(() => {
      expect(subscriptionService.startUpgrade).toHaveBeenCalledWith("pro");
    });
  });
});
