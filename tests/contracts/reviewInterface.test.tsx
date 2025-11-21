import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ReviewInterface from "@/app/contracts/review/review-interface";

const mockRouter = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  promise: vi.fn(),
}));

const mockGetReviewStateAction = vi.hoisted(() => vi.fn());
const mockSaveReviewStateAction = vi.hoisted(() => vi.fn());
const mockSaveReviewedVersionAction = vi.hoisted(() => vi.fn());
const mockCreateIncomingAgreementAction = vi.hoisted(() => vi.fn());

const mockUseCopilotAction = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/contracts/review/actions", () => ({
  createIncomingAgreementAction: mockCreateIncomingAgreementAction,
  getReviewStateAction: mockGetReviewStateAction,
  saveReviewStateAction: mockSaveReviewStateAction,
  saveReviewedVersionAction: mockSaveReviewedVersionAction,
}));

vi.mock("@/lib/copilot/hooks", () => ({
  useCopilotAction: (...args: unknown[]) => mockUseCopilotAction(...args),
}));

vi.mock("@radix-ui/react-tooltip", () => {
  const React = require("react");
  const PassThrough = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Provider: PassThrough,
    Root: PassThrough,
    Trigger: PassThrough,
    Content,
    Portal: PassThrough,
    Arrow: () => null,
  };
});

vi.mock("sonner", () => ({
  toast: toastMock,
}));

describe("ReviewInterface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCopilotAction.mockReturnValue({ run: vi.fn(), isLoading: false });
    mockGetReviewStateAction.mockResolvedValue(null);
    mockSaveReviewStateAction.mockResolvedValue({ success: true });
    mockSaveReviewedVersionAction.mockResolvedValue({ success: true });
    mockCreateIncomingAgreementAction.mockResolvedValue({ success: true });
  });

  const baseResponse = {
    success: true,
    data: {
      content: "Original clause A\nOriginal clause B",
      proposals: [
        {
          originalText: "Original clause A",
          proposedText: "Updated clause A",
          rationale: "Policy mismatch",
        },
      ],
      reviewDataExists: true,
      type: "MSA",
      counterparty: "Acme",
    },
  };

  it("hashes proposal ids and saves decisions when accepting a change", async () => {
    mockGetReviewStateAction.mockResolvedValueOnce(baseResponse);

    render(<ReviewInterface agreementId="agr_123" />);

    await screen.findByText("Review Agreement");
    await userEvent.click(screen.getByText("Updated clause A"));
    await userEvent.click(screen.getByRole("button", { name: /Accept Change/i }));

    await waitFor(() => {
      expect(mockSaveReviewStateAction).toHaveBeenCalled();
    });

    const [, payload] = mockSaveReviewStateAction.mock.calls[0];
    expect(payload[0].id).toMatch(/^prop_/);
    expect(payload[0].decision).toBe("accepted");
  });

  it("confirms changes and calls saveReviewedVersionAction", async () => {
    mockGetReviewStateAction.mockResolvedValueOnce(baseResponse);
    mockSaveReviewedVersionAction.mockResolvedValueOnce({ success: true });

    render(<ReviewInterface agreementId="agr_123" />);

    await screen.findByText("Review Agreement");
    await userEvent.click(screen.getByText("Updated clause A"));
    await userEvent.click(screen.getByRole("button", { name: /Accept Change/i }));
    await screen.findByRole("button", { name: /Confirm Changes & Save/i });
    await userEvent.click(screen.getByRole("button", { name: /Confirm Changes & Save/i }));

    await waitFor(() => {
      expect(mockSaveReviewedVersionAction).toHaveBeenCalled();
    });

    const [agreementId, finalContent, summary] =
      mockSaveReviewedVersionAction.mock.calls[0];
    expect(agreementId).toBe("agr_123");
    expect(finalContent).toContain("Updated clause A");
    expect(summary).toContain("1 change");
  });

  it("renders inline proposals even when whitespace differs", async () => {
    mockGetReviewStateAction.mockResolvedValueOnce({
      success: true,
      data: {
        content: "Original clause A\nOriginal clause B",
        proposals: [
          {
            originalText: "Original clause A Original clause B",
            proposedText: "Updated clause spanning two lines",
            rationale: "Whitespace mismatch",
          },
        ],
        reviewDataExists: true,
        type: "MSA",
        counterparty: "Acme",
      },
    });

    render(<ReviewInterface agreementId="agr_ws" />);

    await screen.findByText("Review Agreement");
    await screen.findByText("Updated clause spanning two lines");
  });

  it("shows fallback cards when proposals cannot be placed inline", async () => {
    mockGetReviewStateAction.mockResolvedValueOnce({
      success: true,
      data: {
        content: "Unrelated document text",
        proposals: [
          {
            originalText: "Missing clause reference",
            proposedText: "Add missing clause",
            rationale: "Policy reminder",
          },
        ],
        reviewDataExists: true,
        type: "MSA",
        counterparty: "Acme",
      },
    });

    render(<ReviewInterface agreementId="agr_missing" />);

    await screen.findByText(/Unable to place 1 change inline/i);
    await screen.findByText("Add missing clause");
  });
});


