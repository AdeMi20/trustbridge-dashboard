import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { checkStellarAddress } from "@/lib/horizon";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { toContributorRow } from "@/lib/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-service recheck endpoint for contributors to verify their own
 * Stellar address readiness. Applies retries, caching, and circuit breaker
 * protection via checkStellarAddress.
 */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find the contributor's existing registration
    const registration = await prisma.registration.findFirst({
      where: { userId: session.user.id },
      include: {
        user: {
          select: { githubUsername: true },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "No registration found. Please register first." },
        { status: 404 }
      );
    }

    // Re-check the stellar address with retry and caching
    const horizonResult = await checkStellarAddress(
      registration.stellarAddress
    );

    // Update registration with latest check results
    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        funded: horizonResult.funded,
        trustlineReady: horizonResult.trustline,
        trustlineAuthorized: horizonResult.trustline_authorized,
        xlmBalance: horizonResult.xlm_balance,
        spendableXlmBalance: horizonResult.spendable_xlm_balance,
        lastCheckedAt: new Date(),
      },
      include: {
        user: {
          select: { githubUsername: true },
        },
      },
    });

    // Record audit log for self-service recheck
    await recordAuditLog({
      action: "recheck.self_service",
      actorId: session.user.id,
      actorLogin: session.user.githubUsername ?? null,
      targetId: updated.id,
      targetLabel: updated.stellarAddress,
      metadata: {
        readiness: horizonResult.readiness,
        verified: horizonResult.verified,
      },
    });

    const contributorRow = toContributorRow(updated);

    return NextResponse.json({
      success: true,
      contributor: contributorRow,
      check: horizonResult,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to recheck registration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
