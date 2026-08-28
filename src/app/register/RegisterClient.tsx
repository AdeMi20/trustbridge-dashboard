"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { AddressInput } from "@/components/AddressInput";
import { FreighterProofCard } from "@/components/FreighterProofCard";
import { OutreachTemplateGenerator } from "@/components/OutreachTemplateGenerator";
import { TrustlineGuidancePanel } from "@/components/TrustlineGuidancePanel";
import { TrustlineStatusBadge } from "@/components/TrustlineStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mapRegisterError, type RegisterFailure } from "@/lib/register-error";
import { buildWalletProofInfo } from "@/lib/registration-insights";
import type { HorizonDebugInfo, WalletProofInfo } from "@/types";

interface RegistrationRecord {
  stellarAddress: string;
  readiness: "ready" | "low_reserve" | "not_ready";
  walletProof?: WalletProofInfo;
  horizonDebug?: HorizonDebugInfo;
  /**
   * Set on the row we paint before the server has answered. The server never
   * sends it, so its presence is exactly "this has not been confirmed yet".
   */
  pending?: boolean;
}

interface RegistrationResponse {
  registration?: RegistrationRecord | null;
}

const REGISTRATION_QUERY_KEY = ["registration"] as const;

export function RegisterClient() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<RegisterFailure | null>(null);

  const maintainerError = searchParams.get("error") === "maintainer";

  const existingQuery = useQuery({
    queryKey: REGISTRATION_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/register");
      if (!response.ok) throw new Error("Failed to load registration");
      return (await response.json()) as RegistrationResponse;
    },
    enabled: !!session,
  });

  /**
   * Optimistic save.
   *
   * The address is already validated against Horizon by the time the button is
   * pressed, so the common case is a save that succeeds — waiting on a network
   * round trip plus a Horizon re-check before showing anything makes a
   * successful save feel broken. The registration card is painted immediately
   * and marked pending.
   *
   * The server stays the source of truth in every direction: `onError` puts
   * the previous cache entry back verbatim, and `onSettled` refetches so the
   * confirmed row — with the readiness the server computed, not the one we
   * guessed — replaces the optimistic one. Nothing here skips validation; it
   * only stops the UI pretending it has no idea what is about to happen.
   */
  const saveMutation = useMutation({
    mutationFn: async (stellarAddress: string) => {
      let response: Response;
      try {
        response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Same-origin so the session cookie rides along and the route's
          // origin check passes.
          credentials: "same-origin",
          body: JSON.stringify({ stellarAddress }),
        });
      } catch {
        // Never reached the server — status 0 maps to the network failure.
        throw mapRegisterError(0, null);
      }

      const data = (await response.json().catch(() => null)) as
        | (RegistrationResponse & { error?: string; code?: string })
        | null;

      if (!response.ok) {
        throw mapRegisterError(response.status, data);
      }

      return data;
    },

    onMutate: async (stellarAddress: string) => {
      setFailure(null);

      // A refetch landing mid-flight would overwrite the optimistic row with
      // the pre-save state and make the save look like it bounced.
      await queryClient.cancelQueries({ queryKey: REGISTRATION_QUERY_KEY });

      const previous = queryClient.getQueryData<RegistrationResponse>(
        REGISTRATION_QUERY_KEY
      );

      queryClient.setQueryData<RegistrationResponse>(
        REGISTRATION_QUERY_KEY,
        (current) => ({
          registration: {
            // Readiness is carried over rather than guessed: only the server's
            // Horizon check can tell us what the new address is worth, and
            // inventing "ready" here would be a lie the user could act on.
            ...(current?.registration ?? {}),
            stellarAddress,
            readiness: current?.registration?.readiness ?? "not_ready",
            pending: true,
          } as RegistrationRecord,
        })
      );

      return { previous };
    },

    onError: (error, _address, context) => {
      // Roll back to exactly what was cached before the attempt.
      queryClient.setQueryData(REGISTRATION_QUERY_KEY, context?.previous);

      const mapped =
        error && typeof error === "object" && "kind" in error
          ? (error as RegisterFailure)
          : mapRegisterError(500, null);

      setFailure(mapped);
      setSaved(false);

      // A taken address is not worth resubmitting — clear it so the next
      // attempt is a different wallet rather than the same rejection.
      if (!mapped.keepAddress) {
        setAddress("");
      }
    },

    onSuccess: () => {
      setSaved(true);
      setFailure(null);
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },

    onSettled: () => {
      // Refetch on both paths: success replaces the optimistic row with the
      // server's, failure re-confirms the rolled-back one.
      void queryClient.invalidateQueries({ queryKey: REGISTRATION_QUERY_KEY });
    },
  });

  const currentRegistration = existingQuery.data?.registration ?? null;
  const existingAddress = currentRegistration?.stellarAddress ?? "";
  const isPendingSave = Boolean(currentRegistration?.pending);
  const proofAddress = address.trim() || existingAddress;
  const proof =
    existingQuery.data?.registration?.walletProof ??
    buildWalletProofInfo(proofAddress, session?.user?.githubUsername ?? null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {maintainerError && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200">
          Maintainer dashboard requires membership in the configured GitHub
          organization. You can still register your Stellar address here.
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Contributor registration</h1>
        <p className="mt-2 text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">
            @{session?.user?.githubUsername}
          </span>
          . Link your GitHub identity to a Stellar G-address for Wave payouts.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          {existingAddress && (
            <Card
              className="border-emerald-500/30 bg-emerald-500/5"
              data-testid="current-registration"
              aria-busy={isPendingSave}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {isPendingSave ? (
                    <Loader2
                      className="h-5 w-5 animate-spin text-emerald-500"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="h-5 w-5 text-emerald-500"
                      aria-hidden="true"
                    />
                  )}
                  {isPendingSave ? "Saving registration…" : "Current registration"}
                </CardTitle>
                <CardDescription
                  className="font-mono text-xs break-all"
                  data-testid="current-registration-address"
                >
                  {existingAddress}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isPendingSave ? (
                  // Deliberately no readiness badge while pending: the badge
                  // is a claim about on-chain state that only the server's
                  // Horizon check can make.
                  <p className="text-sm text-muted-foreground">
                    Confirming with the Stellar network…
                  </p>
                ) : (
                  currentRegistration?.readiness && (
                    <TrustlineStatusBadge status={currentRegistration.readiness} />
                  )
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {existingAddress ? "Update Stellar address" : "Stellar address"}
              </CardTitle>
              <CardDescription>
                Enter your public key (starts with G). Validation runs as you
                type via Horizon, and the proof panel shows the exact Freighter
                challenge maintainers can ask you to sign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddressInput
                value={address}
                onChange={setAddress}
                disabled={saveMutation.isPending}
              />

              {failure && (
                <div
                  className="rounded-md border border-destructive/60 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  // `alert` rather than a polite region: the save the user just
                  // asked for did not happen, and the optimistic card they are
                  // looking at has already reverted underneath them.
                  role="alert"
                  data-testid="registration-error"
                  data-failure-kind={failure.kind}
                >
                  <p>{failure.message}</p>
                  {failure.requiresSignIn && (
                    <p className="mt-1 text-xs">
                      Use the sign-in button in the header to start a new
                      session, then save again.
                    </p>
                  )}
                </div>
              )}

              {saved && !failure && (
                <p
                  className="text-sm text-emerald-600 dark:text-emerald-400"
                  role="status"
                  aria-live="polite"
                  data-testid="registration-saved"
                >
                  Registration saved successfully.
                </p>
              )}

              <Button
                variant="stellar"
                disabled={!address.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate(address.trim())}
                data-testid="save-registration"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save registration"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <FreighterProofCard proof={proof} addressReady={Boolean(proofAddress)} />
          <TrustlineGuidancePanel />
        </div>
      </div>

      <div className="mt-12 border-t pt-8">
        <OutreachTemplateGenerator />
      </div>
    </div>
  );
}
