import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockContractCall = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    registration: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("stellar-sdk", () => ({
  Contract: vi.fn().mockImplementation(() => ({
    call: mockContractCall,
  })),
  rpc: {
    Server: vi.fn(),
  },
  scValToNative: vi.fn(() => []),
}));

import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  getContractSyncHealth,
  resetContractSyncState,
  syncContractToPostgres,
} from "@/lib/contract-sync";

describe("contract-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetContractSyncState();
    delete process.env.CONTRACT_SYNC_MIN_INTERVAL_MS;
    delete process.env.SOROBAN_CONTRACT_ID;
    mockContractCall.mockResolvedValue([]);
    vi.mocked(prisma.registration.findMany).mockResolvedValue([]);
    vi.mocked(prisma.registration.update).mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a sync, records an audit log, and updates health on success", async () => {
    process.env.SOROBAN_CONTRACT_ID = "CABC123";

    const result = await syncContractToPostgres();

    expect(result.status).toBe("ok");
    expect(result.synced).toBe(0);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "contract.sync" })
    );
    expect(getContractSyncHealth()).toEqual(result);
  });

  it("never throws when Postgres sync fails, and records the error", async () => {
    process.env.SOROBAN_CONTRACT_ID = "CABC123";
    vi.mocked(prisma.registration.findMany).mockRejectedValue(
      new Error("Horizon RPC outage")
    );

    const result = await syncContractToPostgres();

    expect(result.status).toBe("error");
    expect(result.errors).toContain("Horizon RPC outage");
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "contract.sync",
        metadata: { error: "Horizon RPC outage" },
      })
    );
    expect(getContractSyncHealth()?.status).toBe("error");
  });

  it("rate-limits back-to-back triggers instead of re-hitting Soroban", async () => {
    process.env.CONTRACT_SYNC_MIN_INTERVAL_MS = "60000";
    process.env.SOROBAN_CONTRACT_ID = "CABC123";

    const first = await syncContractToPostgres();
    const second = await syncContractToPostgres();

    expect(first.status).toBe("ok");
    expect(second.status).toBe("skipped");
    expect(mockContractCall).toHaveBeenCalledTimes(1);
    expect(prisma.registration.findMany).toHaveBeenCalledTimes(1);
  });
});
