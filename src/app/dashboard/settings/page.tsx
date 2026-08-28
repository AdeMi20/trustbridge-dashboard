"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { NetworkStatusPanel } from "@/components/NetworkStatusPanel";
import { SessionPanel } from "@/components/SessionPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { describeAuditAction } from "@/lib/audit-format";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditLogEntry, NetworkConfig } from "@/types";

interface AuditLogResponse {
  entries: AuditLogEntry[];
  summary: { total: number; byAction: Record<string, number> };
}

export default function MaintainerSettingsPage() {
  const networkQuery = useQuery({
    queryKey: ["network-config"],
    queryFn: async () => {
      const response = await fetch("/api/settings/network");
      if (!response.ok) throw new Error("Failed to load network config");
      return (await response.json()) as NetworkConfig;
    },
  });

  const auditQuery = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const response = await fetch("/api/audit?limit=25");
      if (!response.ok) throw new Error("Failed to load audit log");
      return (await response.json()) as AuditLogResponse;
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Maintainer settings</h1>
        <p className="mt-2 text-muted-foreground">
          Network configuration and recent maintainer activity for this
          TrustBridge deployment.
        </p>
      </div>

      <div className="mb-8">
        <SessionPanel />
      </div>

      <div className="mb-8">
        {networkQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading network configuration...
          </div>
        ) : networkQuery.isError ? (
          <p className="text-destructive">
            Failed to load network configuration.
          </p>
        ) : networkQuery.data ? (
          <NetworkStatusPanel config={networkQuery.data} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Rechecks, registrations, and configuration events recorded for
            this deployment, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading activity...
            </div>
          ) : auditQuery.isError ? (
            <p className="text-destructive">Failed to load audit log.</p>
          ) : !auditQuery.data || auditQuery.data.entries.length === 0 ? (
            <p className="text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {auditQuery.data.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {describeAuditAction(entry.action)}
                    </Badge>
                    {entry.targetLabel && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.targetLabel}
                      </span>
                    )}
                    {entry.actorLogin && (
                      <span className="text-muted-foreground">
                        by @{entry.actorLogin}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
