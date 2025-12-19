import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    BondLifecycleEffect,
    BondLifecycleInstruction,
} from "@denotecapital/token-sdk";

export interface LifecycleClaimRequest {
    contractId: string;
    effectCid: string;
    bondHoldingCid: string;
    holder: string;
    issuer: string;
}

export function useLifecycleEffect(partyId: string | null) {
    return useQuery<BondLifecycleEffect | null>({
        queryKey: ["lifecycleEffect", partyId],
        queryFn: async () => {
            if (!partyId) throw new Error("Party ID required");

            const params = new URLSearchParams({ partyId });
            const response = await fetch(
                `/api/wallet/bond/lifecycle/effect?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get lifecycle effect"
                );
            }

            return response.json();
        },
        enabled: !!partyId,
        refetchInterval: 5000,
    });
}

export function useAllLifecycleEffects(partyId: string | null) {
    return useQuery<BondLifecycleEffect[]>({
        queryKey: ["allLifecycleEffects", partyId],
        queryFn: async () => {
            if (!partyId) throw new Error("Party ID required");

            const params = new URLSearchParams({ partyId });
            const response = await fetch(
                `/api/wallet/bond/lifecycle/effect?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get lifecycle effects"
                );
            }

            const data = await response.json();
            return data;
        },
        enabled: !!partyId,
        refetchInterval: 5000,
    });
}

export function useBondLifecycle() {
    const queryClient = useQueryClient();

    const processEvent = useMutation<
        { effectCid: string; producedVersion: string | null },
        Error,
        {
            lifecycleRuleCid: string;
            eventType: "coupon" | "redemption";
            targetInstrumentId: string;
            targetVersion: string;
            bondCid: string;
            partyId: string;
            seed: string;
        }
    >({
        mutationFn: async (params) => {
            const response = await fetch("/api/wallet/bond/lifecycle/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to process lifecycle event"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["lifecycleEffect"],
            });
        },
    });

    return { processEvent };
}

export function useLifecycleClaimRequest(
    holder: string | null,
    issuer: string | null
) {
    const queryClient = useQueryClient();

    const get = useQuery<{ requests: LifecycleClaimRequest[] }>({
        queryKey: ["lifecycleClaimRequests", holder, issuer],
        queryFn: async () => {
            if (!holder || !issuer)
                throw new Error("Holder and issuer required");

            const params = new URLSearchParams({
                partyId: holder,
                issuer,
            });

            const response = await fetch(
                `/api/wallet/bond/lifecycle/claim-request?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get lifecycle claim requests"
                );
            }

            return response.json();
        },
        enabled: !!holder && !!issuer,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            effectCid: string;
            bondHoldingCid: string;
            bondRulesCid: string;
            bondInstrumentCid: string;
            currencyTransferFactoryCid: string;
            issuerCurrencyHoldingCid: string;
            holder: string;
            issuer: string;
            seed: string;
            disclosure?: unknown;
        }) => {
            const response = await fetch(
                "/api/wallet/bond/lifecycle/claim-request",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create lifecycle claim request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [
                    "lifecycleClaimRequests",
                    variables.holder,
                    variables.issuer,
                ],
            });
        },
    });

    return {
        get,
        create,
    };
}

export function useLifecycleInstruction(partyId: string | null) {
    const queryClient = useQueryClient();

    const getAll = useQuery<BondLifecycleInstruction[]>({
        queryKey: ["allLifecycleInstructions", partyId],
        queryFn: async () => {
            if (!partyId) throw new Error("Party ID required");

            const params = new URLSearchParams({ partyId });
            const response = await fetch(
                `/api/wallet/bond/lifecycle/instruction?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get lifecycle instructions"
                );
            }

            const data = await response.json();
            return data;
        },
        enabled: !!partyId,
        refetchInterval: 5000,
    });

    const process = useMutation({
        mutationFn: async (params: {
            contractId: string;
            partyId: string;
            seed: string;
            disclosure?: unknown;
        }) => {
            const response = await fetch(
                "/api/wallet/bond/lifecycle/instruction",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to process lifecycle instruction"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["lifecycleInstruction"],
            });
            queryClient.invalidateQueries({
                queryKey: ["allLifecycleInstructions"],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
            queryClient.invalidateQueries({
                queryKey: ["transferInstructions"],
            });
        },
    });

    return {
        getAll,
        process,
    };
}
