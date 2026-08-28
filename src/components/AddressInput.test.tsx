import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddressInput } from "@/components/AddressInput";

const VALID =
  "GDXNXL25GDM3N5LAR5FALA3VSGHFET3EOKLXRP3ITPPMR3PISTQSKSFS";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
  },
}));

describe("AddressInput QR and copy", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        funded: true,
        trustline: true,
        trustline_authorized: true,
        verified: false,
        xlm_balance: "5",
        spendable_xlm_balance: "4",
        usdc_balance: "0",
        errors: [],
        readiness: "ready",
      }),
    }) as unknown as typeof fetch;
  });

  it("does not show QR or enable copy for invalid addresses", () => {
    render(<AddressInput value="GNOTVALID" onChange={() => {}} />);

    expect(screen.queryByTestId("address-qr")).not.toBeInTheDocument();
    expect(screen.getByTestId("copy-address")).toBeDisabled();
    expect(screen.getByTestId("address-invalid-hint")).toBeInTheDocument();
  });

  it("shows QR and copies a valid G-address with confirmation", async () => {
    render(<AddressInput value={VALID} onChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("address-qr")).toBeInTheDocument();
    });

    const img = screen.getByRole("img", {
      name: new RegExp(`QR code for Stellar address ${VALID}`),
    });
    expect(img).toHaveAttribute("src", "data:image/png;base64,qr");

    fireEvent.click(screen.getByTestId("copy-address"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(VALID);
      expect(screen.getByTestId("copy-address")).toHaveTextContent("Copied");
      expect(screen.getByTestId("copy-address-status")).toHaveTextContent(
        /Address copied to clipboard/i
      );
    });
  });
});
