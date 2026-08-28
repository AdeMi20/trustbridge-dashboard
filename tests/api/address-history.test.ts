/**
 * API tests — GET /api/address-history (#137)
 *
 * Self-only access to a contributor's own AddressHistoryRecord timeline.
 * Maintainers may pass ?userId= to look up another user's history; the
 * critical case is that non-maintainers passing that param NEVER leak
 * another user's history (IDOR).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/address-history/route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/address-history", () => ({ getAddressHistory: vi.fn() }));

import { getServerSession } from "next-auth";
import { getAddressHistory } from "@/lib/address-history";

function getRequest(query = "") {
  return new NextRequest(`http://localhost:3000/api/address-history${query}`);
}

function mockSession(opts: { id?: string; isMaintainer?: boolean } = {}) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: opts.id ?? "user-1", isMaintainer: opts.isMaintainer ?? false },
  } as never);
}

const SAMPLE_HISTORY = [
  {
    stellarAddress: "GBSX" + "X".repeat(52),
    changeType: "updated",
    recordedAt: new Date("2026-08-01T00:00:00.000Z"),
  },
  {
    stellarAddress: "GAAA" + "A".repeat(52),
    changeType: "initial",
    recordedAt: new Date("2026-07-01T00:00:00.000Z"),
  },
];

afterEach(() => vi.clearAllMocks());

describe("GET /api/address-history — authentication", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
    expect(getAddressHistory).not.toHaveBeenCalled();
  });
});

describe("GET /api/address-history — self access", () => {
  it("a signed-in contributor gets their own history back", async () => {
    mockSession({ id: "user-1", isMaintainer: false });
    vi.mocked(getAddressHistory).mockResolvedValue(SAMPLE_HISTORY as never);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    expect(getAddressHistory).toHaveBeenCalledWith("user-1");
    const json = await res.json();
    expect(json.history).toHaveLength(2);
  });

  it("returns an empty array when the user has no history yet", async () => {
    mockSession({ id: "user-1", isMaintainer: false });
    vi.mocked(getAddressHistory).mockResolvedValue([]);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.history).toEqual([]);
  });
});

describe("GET /api/address-history — maintainer lookup", () => {
  it("a maintainer passing ?userId= gets that other user's history", async () => {
    mockSession({ id: "maintainer-1", isMaintainer: true });
    vi.mocked(getAddressHistory).mockResolvedValue(SAMPLE_HISTORY as never);

    const res = await GET(getRequest("?userId=other-user"));
    expect(res.status).toBe(200);
    expect(getAddressHistory).toHaveBeenCalledWith("other-user");
  });

  it("a maintainer with no ?userId= still gets their own history", async () => {
    mockSession({ id: "maintainer-1", isMaintainer: true });
    vi.mocked(getAddressHistory).mockResolvedValue([]);

    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    expect(getAddressHistory).toHaveBeenCalledWith("maintainer-1");
  });
});

describe("GET /api/address-history — IDOR prevention", () => {
  it("a non-maintainer passing ?userId=<other-user-id> only gets their OWN history back", async () => {
    mockSession({ id: "user-1", isMaintainer: false });
    vi.mocked(getAddressHistory).mockResolvedValue(SAMPLE_HISTORY as never);

    const res = await GET(getRequest("?userId=attacker-target-user"));

    expect(res.status).toBe(200);
    // Never called with the attacker-supplied userId.
    expect(getAddressHistory).not.toHaveBeenCalledWith("attacker-target-user");
    // Always called with the session user's own id.
    expect(getAddressHistory).toHaveBeenCalledWith("user-1");
    expect(getAddressHistory).toHaveBeenCalledTimes(1);
  });
});
