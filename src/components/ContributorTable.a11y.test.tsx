/**
 * Issue #143 — keyboard and landmark contract for the contributor table.
 *
 * The table is the densest control surface in the app: a search box, four
 * filter buttons, a column toggle, up to eight column checkboxes, two export
 * buttons, and a re-check button per row. Everything here exists so a keyboard
 * user can get in, get out, and not lose their place on the way.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csv", async () => {
  const actual = await vi.importActual<typeof import("@/lib/csv")>("@/lib/csv");
  return {
    ...actual,
    buildCsvFilename: vi.fn(() => "trustbridge-wave-2026-07-26.csv"),
    buildJsonFilename: vi.fn(() => "trustbridge-wave-2026-07-26.json"),
    // jsdom has no URL.createObjectURL, which the JSON path would reach.
    downloadCsv: vi.fn(),
    downloadJson: vi.fn(),
  };
});

import {
  ContributorTable,
  exportContributorsCsv,
} from "@/components/ContributorTable";
import { downloadCsv } from "@/lib/csv";
import type { ContributorRow } from "@/types";

const contributors: ContributorRow[] = [
  {
    id: "row-1",
    githubUsername: "alice",
    stellarAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    funded: true,
    trustlineReady: true,
    trustlineAuthorized: true,
    verified: true,
    xlmBalance: "10",
    spendableXlmBalance: "8",
    readiness: "ready",
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: "row-2",
    githubUsername: "bob",
    stellarAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    funded: true,
    trustlineReady: false,
    trustlineAuthorized: false,
    verified: false,
    xlmBalance: "2",
    spendableXlmBalance: "0.2",
    readiness: "not_ready",
    lastCheckedAt: new Date().toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContributorTable — landmarks", () => {
  it("is a labelled region so it can be jumped to and announced", () => {
    render(<ContributorTable contributors={contributors} />);

    const region = screen.getByRole("region", {
      name: /contributor payout readiness/i,
    });
    expect(region).toBeInTheDocument();
    // The dashboard skip link targets this id.
    expect(region).toHaveAttribute("id", "contributor-table");
  });

  it("is focusable as a skip-link target without joining the tab order", () => {
    render(<ContributorTable contributors={contributors} />);

    const region = screen.getByTestId("contributor-table-region");
    expect(region).toHaveAttribute("tabindex", "-1");
  });

  it("opens at h2 so it nests under the page h1", () => {
    render(<ContributorTable contributors={contributors} />);

    // A second h1 would give the page two competing document titles.
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /contributor payout readiness/i })
    ).toBeInTheDocument();
  });

  it("groups the toolbar so it is not an unnamed pile of buttons", () => {
    render(<ContributorTable contributors={contributors} onExport={vi.fn()} />);

    const group = screen.getByRole("group", {
      name: /contributor table controls/i,
    });
    expect(within(group).getByRole("searchbox")).toBeInTheDocument();
  });

  it("keeps the table caption", () => {
    // Explicit constraint on the issue: captions must not be removed.
    render(<ContributorTable contributors={contributors} />);

    expect(
      screen.getByText(/Contributor payout readiness table with per-row Horizon debug/i)
    ).toBeInTheDocument();
  });

  it("keeps aria-sort on the sortable headers", () => {
    render(<ContributorTable contributors={contributors} />);

    expect(screen.getByRole("columnheader", { name: /GitHub/i })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
  });

  it("renders the mobile card path inside the same region", () => {
    // The skip target has to exist at every breakpoint; the cards and the
    // table are both children of the region, not siblings of it.
    render(<ContributorTable contributors={contributors} />);

    const region = screen.getByTestId("contributor-table-region");
    expect(within(region).getAllByRole("article").length).toBe(
      contributors.length
    );
  });
});

describe("ContributorTable — column picker focus", () => {
  it("announces expanded state rather than a pressed state", async () => {
    const user = userEvent.setup();
    render(<ContributorTable contributors={contributors} />);

    const toggle = screen.getByRole("button", { name: /columns/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("moves focus into the panel when it opens", async () => {
    const user = userEvent.setup();
    render(<ContributorTable contributors={contributors} />);

    await user.click(screen.getByRole("button", { name: /columns/i }));

    expect(screen.getByTestId("column-picker")).toHaveFocus();
  });

  it("returns focus to the toggle when closed by click", async () => {
    const user = userEvent.setup();
    render(<ContributorTable contributors={contributors} />);

    const toggle = screen.getByRole("button", { name: /columns/i });
    await user.click(toggle);
    await user.click(toggle);

    expect(screen.queryByTestId("column-picker")).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("closes on Escape and returns focus to the toggle", async () => {
    const user = userEvent.setup();
    render(<ContributorTable contributors={contributors} />);

    const toggle = screen.getByRole("button", { name: /columns/i });
    await user.click(toggle);
    await user.keyboard("{Escape}");

    expect(screen.queryByTestId("column-picker")).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("does not strand focus on the removed panel", async () => {
    const user = userEvent.setup();
    render(<ContributorTable contributors={contributors} />);

    const toggle = screen.getByRole("button", { name: /columns/i });
    await user.click(toggle);
    await user.keyboard("{Escape}");

    // Focus on <body> means the next Tab restarts at the top of the document.
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe("ContributorTable — export focus restoration", () => {
  it("returns focus to the CSV button after the export dialog closes", async () => {
    const user = userEvent.setup();
    // window.confirm is a modal dialog; browsers do not reliably hand focus
    // back to the trigger when it closes.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onExport = vi.fn();

    render(<ContributorTable contributors={contributors} onExport={onExport} />);

    const csvButton = screen.getByRole("button", { name: /Export CSV/i });
    await user.click(csvButton);

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(csvButton).toHaveFocus();
    confirmSpy.mockRestore();
  });

  it("returns focus to the JSON button after the export dialog closes", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ContributorTable contributors={contributors} onExport={vi.fn()} />);

    const jsonButton = screen.getByRole("button", { name: /Export JSON/i });
    await user.click(jsonButton);

    expect(jsonButton).toHaveFocus();
    confirmSpy.mockRestore();
  });

  it("restores focus when the stale-data confirm is declined", async () => {
    const user = userEvent.setup();
    // The real dashboard wiring: `onExport` runs `exportContributorsCsv`,
    // which prompts before exporting rows nobody has re-checked. Declining is
    // the path where the user most needs to be left where they were, because
    // nothing else on screen changes to reorient them.
    const stale = contributors.map((row) => ({ ...row, lastCheckedAt: null }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ContributorTable
        contributors={stale}
        onExport={() => exportContributorsCsv(stale)}
      />
    );

    const csvButton = screen.getByRole("button", { name: /Export CSV/i });
    await user.click(csvButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(downloadCsv).not.toHaveBeenCalled();
    expect(csvButton).toHaveFocus();
    confirmSpy.mockRestore();
  });

  it("restores focus even when the export handler throws", async () => {
    const user = userEvent.setup();
    // React re-throws handler errors as an uncaught window error in jsdom;
    // swallow it so the assertion below is what the test reports on.
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", swallow);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const onExport = vi.fn(() => {
      throw new Error("download blocked");
    });

    render(<ContributorTable contributors={contributors} onExport={onExport} />);

    const csvButton = screen.getByRole("button", { name: /Export CSV/i });
    await user.click(csvButton);

    // `runExport` restores focus in a `finally`: a failed export must not also
    // cost the user their place in the page.
    expect(onExport).toHaveBeenCalled();
    expect(csvButton).toHaveFocus();

    consoleSpy.mockRestore();
    window.removeEventListener("error", swallow);
  });
});
