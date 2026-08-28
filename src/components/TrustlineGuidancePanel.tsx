import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WalletInstallStepper } from "@/components/WalletInstallStepper";

/**
 * Contributor-facing setup guide.
 *
 * Written for a GitHub contributor who has never used Stellar: every term that
 * only makes sense inside Stellar ("trustline", "reserve", "G-address") is
 * introduced with what it actually does. Field-level Horizon detail stays in
 * the maintainer "Horizon debug" panel — see `docs/READINESS_MODEL.md`.
 *
 * The embedded `WalletInstallStepper` lets the contributor pick one of three
 * supported wallets (Freighter, LOBSTR, xBull) and follow a step-by-step guide
 * that ends with a deep link directly into that wallet's trustline-add flow.
 */
export function TrustlineGuidancePanel() {
  return (
    <Card
      className="border-stellar-cyan/20 bg-gradient-to-br from-stellar-purple/5 to-stellar-cyan/5"
      data-testid="trustline-guidance"
    >
      <CardHeader>
        <CardTitle className="text-lg">
          New to Stellar? Set your wallet up first
        </CardTitle>
        <CardDescription>
          Payouts arrive as USDC on the Stellar network. Before a wallet can
          receive USDC it needs two things: a small XLM deposit to exist on the
          network, and a <em>trustline</em> — a one-time opt-in that tells
          Stellar the wallet accepts USDC. Pick a wallet below and follow the
          four steps. It usually takes about ten minutes.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        {/* Overview checklist — orient the contributor before they dive in */}
        <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground marker:text-foreground">
          <li>
            <span className="font-medium text-foreground">
              Choose a wallet
            </span>{" "}
            — pick whichever tab suits you: Freighter (browser extension),
            LOBSTR (mobile + extension), or xBull (extension + PWA).
          </li>
          <li>
            <span className="font-medium text-foreground">
              Install and fund it
            </span>{" "}
            — follow the steps in the panel; send at least 1 XLM to activate
            the address.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Add the USDC trustline
            </span>{" "}
            — click the deep-link button at the bottom of the step list. It
            opens the wallet with USDC pre-selected so you only need to confirm.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Paste your G-address below
            </span>{" "}
            — the address starting with a capital <code>G</code>. Never share
            the secret key (starts with <code>S</code>).
          </li>
        </ol>

        {/* Wallet picker + per-wallet guides */}
        <WalletInstallStepper />

        <p className="text-xs text-muted-foreground">
          You can save your address as soon as you have it — you do not need to
          wait for the badge to turn green. Re-run the check any time after
          finishing the trustline setup.
        </p>
      </CardContent>
    </Card>
  );
}
