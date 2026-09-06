import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const STATISTICS_ROOT = "/api/statistics";

export function invalidateStatisticsQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: matchesStatisticsKey });
}

export function matchesStatisticsKey(query: { queryKey: QueryKey }): boolean {
  const [root] = query.queryKey;
  if (typeof root !== "string") return false;
  return root === STATISTICS_ROOT || root.startsWith(`${STATISTICS_ROOT}/`);
}
