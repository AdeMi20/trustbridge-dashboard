import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MetricsPage from "@/app/dashboard/metrics/page";

const metricsFixture = {
  contributors: {
    total: 3,
    ready: 1,
    readyPercent: 33,
    byStatus: { ready: 1, low_reserve: 1, not_ready: 1 },
  },
  audit: {
    recentEntries: 2,
    byAction: { "recheck.single": 3, "recheck.batch": 1 },
    latestAt: "2026-07-25T10:00:00.000Z",
  },
  config: {
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 10,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerRecoveryMs: 30_000,
    staleCsvMaxAgeMs: 86_400_000,
    horizonUrl: "https://horizon.stellar.org",
    sorobanContractConfigured: false,
  },
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    data: metricsFixture,
  }),
}));

describe("MetricsPage layout", () => {
  it("renders a mobile-first stacked readiness grid", () => {
    const { container } = render(<MetricsPage />);

    expect(screen.getByTestId("metrics-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /admin metrics/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/3 registered contributors/i)).toBeInTheDocument();

    const readinessGrid = container.querySelector(
      ".grid.grid-cols-1.sm\\:grid-cols-3"
    );
    expect(readinessGrid).toBeTruthy();
  });

  it("shows mobile audit cards and a desktop table with the same data", () => {
    render(<MetricsPage />);

    expect(screen.getByTestId("metrics-audit-mobile")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-audit-table")).toBeInTheDocument();
    expect(screen.getAllByText("recheck.single").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps all readiness counts visible", () => {
    render(<MetricsPage />);

    expect(screen.getByText(/✅ ready/i)).toBeInTheDocument();
    expect(screen.getByText(/low reserve/i)).toBeInTheDocument();
    expect(screen.getByText(/not ready/i)).toBeInTheDocument();
  });
});
