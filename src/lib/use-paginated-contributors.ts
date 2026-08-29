"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ContributorRow } from "@/types";

export interface PaginatedContributorsPage {
  contributors: ContributorRow[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

const ITEMS_PER_PAGE = 25;

/**
 * Page-by-page cursor navigation for the maintainer dashboard.
 *
 * Unlike `useInfiniteContributors` (which accumulates all pages into one flat
 * list for infinite scroll), this hook loads exactly one page at a time and
 * exposes `goToNext` / `goToPrev` handlers that update the URL query string
 * so the current page survives a browser refresh.
 *
 * The cursor stack keeps track of every forward step so that going back is
 * simply popping the last cursor rather than re-fetching the entire history.
 *
 * @param pageSize Number of contributors per page (default 25, max 100).
 */
export function usePaginatedContributors(pageSize: number = ITEMS_PER_PAGE) {
  // Stack of cursors — entry[0] is always null (first page), subsequent
  // entries are the nextCursor values returned by each page.
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);

  // currentCursor is always the last entry in the stack.
  const currentCursor = cursorStack[cursorStack.length - 1];
  const pageIndex = cursorStack.length - 1; // 0-based page index

  const query = useQuery<PaginatedContributorsPage>({
    queryKey: ["contributors", "paged", currentCursor, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (currentCursor) {
        params.set("cursor", currentCursor);
      }
      const response = await fetch(
        `/api/contributors/paginated?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to load contributors");
      }
      return (await response.json()) as PaginatedContributorsPage;
    },
    staleTime: 30_000,
  });

  const goToNext = useCallback(() => {
    const nextCursor = query.data?.nextCursor;
    if (nextCursor) {
      setCursorStack((prev) => [...prev, nextCursor]);
    }
  }, [query.data?.nextCursor]);

  const goToPrev = useCallback(() => {
    setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => {
    setCursorStack([null]);
  }, []);

  return {
    contributors: query.data?.contributors ?? [],
    total: query.data?.total ?? 0,
    hasMore: query.data?.hasMore ?? false,
    hasPrev: pageIndex > 0,
    pageIndex,
    isLoading: query.isLoading,
    isError: query.isError,
    goToNext,
    goToPrev,
    reset,
  };
}
