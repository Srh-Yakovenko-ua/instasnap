import type { Nullable } from "@app/shared";

export type StatisticsQueryLike<TData> = {
  data: TData | undefined;
  error: Nullable<unknown>;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
};

export type StatisticsScopeState<TData> = {
  data: TData | undefined;
  hasUsableData: boolean;
  isInitialError: boolean;
  isInitialLoading: boolean;
  isRefetchError: boolean;
  isRefreshing: boolean;
  retry: () => void;
};

export function toStatisticsScopeState<TData>(
  query: StatisticsQueryLike<TData>,
): StatisticsScopeState<TData> {
  const hasUsableData = query.data !== undefined;

  return {
    data: query.data,
    hasUsableData,
    isInitialError: query.isError && !hasUsableData,
    isInitialLoading: !hasUsableData && !query.isError,
    isRefetchError: query.isError && hasUsableData,
    isRefreshing: query.isFetching && hasUsableData,
    retry: () => void query.refetch(),
  };
}
