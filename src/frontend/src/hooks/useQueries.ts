import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";

export interface UserProfile {
  username: string;
  email: string;
}

export function useUserProfile() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<UserProfile | null>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      if (!actor) return null;
      const a = actor as unknown as {
        getCallerUserProfile?: () => Promise<UserProfile | null>;
      };
      return a.getCallerUserProfile?.() ?? null;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveUserProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Not connected");
      const a = actor as unknown as {
        saveCallerUserProfile?: (p: UserProfile) => Promise<void>;
      };
      await a.saveCallerUserProfile?.(profile);
      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["userProfile"], profile);
    },
  });
}
