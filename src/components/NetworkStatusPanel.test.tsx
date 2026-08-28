import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NetworkStatusPanel } from "@/components/NetworkStatusPanel";
import type { NetworkConfig } from "@/types";

function buildConfig(overrides: Partial<NetworkConfig> = {}): NetworkConfig {
  return {
    horizonUrl: "https://horizon.stellar.org",
    horizonNetwork: "mainnet",
    sorobanUrl: "https://soroban-testnet.stellar.org",
    sorobanNetwork: "testnet",
    sorobanContractConfigured: true,
    mismatched: true,
    actionAlignment: {
      horizonUrl: "https://horizon.stellar.org",
      assetCode: "USDC",
      assetIssuer:
        "GBBD47IF6LCC7MMEODA5SK4AZVTM6MDIEGJYDRC5CJTKJZ4OYVPMXMY6",
      minXlmBalance: 1,
      expected: {
        horizonUrl: "https://horizon.stellar.org",
        assetCode: "USDC",
        assetIssuer:
          "GBBD47IF6LCC7MMEODA5SK4AZVTM6MDIEGJYDRC5CJTKJZ4OYVPMXMY6",
        minXlmBalance: 1,
      },
      aligned: true,
      warnings: [],
    },
    warnings: [
      "Horizon is configured for mainnet (https://horizon.stellar.org) but Soroban RPC is configured for testnet (https://soroban-testnet.stellar.org). Contributor funding and Soroban events are being read from different networks.",
    ],
    ...overrides,
  };
}

describe("NetworkStatusPanel", () => {
  it("shows a paused-network empty state with actionable steps when networks mismatch", () => {
    render(<NetworkStatusPanel config={buildConfig()} />);

    const pausedState = screen.getByTestId("network-paused-empty");
    expect(pausedState).toHaveTextContent(/Network paused/i);
    expect(pausedState).toHaveTextContent(
      /Horizon and Soroban RPC disagree/i
    );
    expect(pausedState).toHaveTextContent(/NEXT_PUBLIC_HORIZON_URL/i);
    expect(pausedState).toHaveTextContent(/SOROBAN_RPC_URL/i);
    expect(pausedState).toHaveTextContent(/horizon-testnet.stellar.org/i);
    expect(pausedState).toHaveTextContent(/mainnet.sorobanrpc.com/i);
    expect(
      screen.getByRole("link", { name: /Review network settings/i })
    ).toHaveAttribute("href", "/dashboard/settings");
  });

  it("shows aligned network copy when Horizon and Soroban RPC match", () => {
    render(
      <NetworkStatusPanel
        config={buildConfig({
          sorobanUrl: "https://mainnet.sorobanrpc.com",
          sorobanNetwork: "mainnet",
          mismatched: false,
          warnings: [],
        })}
      />
    );

    expect(screen.getByText(/Network configuration/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("network-paused-empty")
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Mainnet$/)).toHaveLength(2);
  });

  it("still renders non-mismatch warnings when the network is aligned", () => {
    render(
      <NetworkStatusPanel
        config={buildConfig({
          sorobanUrl: "https://soroban-testnet.stellar.org",
          sorobanNetwork: "testnet",
          mismatched: false,
          warnings: ["SOROBAN_CONTRACT_ID is not configured — the Soroban event timeline is disabled."],
        })}
      />
    );

    expect(
      screen.getByText(/SOROBAN_CONTRACT_ID is not configured/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("network-paused-empty")
    ).not.toBeInTheDocument();
  });
});
