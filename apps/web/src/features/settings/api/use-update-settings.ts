import type { SettingsView, UpdateSettingsInput } from "@app/shared";

import { SettingsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { settingsControllerUpdateSettings } from "@/shared/api/generated/endpoints/profile/profile";

import { settingsKeys } from "./settings-keys";

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSettingsInput): Promise<SettingsView> =>
      SettingsViewSchema.parse(await settingsControllerUpdateSettings(input)),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.root, settings);
      void invalidateStatisticsQueries(queryClient);
    },
  });
}
