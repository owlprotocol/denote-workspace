import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface EtfMintRequest {
    contractId: string;
    mintRecipeCid: string;
    requester: string;
    amount: number;
    transferInstructionCids: string[];
    issuer: string;
}

export function useEtfMintRequest(
    partyId: string | null,
    issuer: string | null
) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["etfMintRequests", partyId, issuer],
        queryFn: async () => {
            if (!partyId || !issuer) {
                throw new Error("Party ID and issuer required");
            }

            const params = new URLSearchParams({
                partyId,
                issuer,
            });

            const response = await fetch(
                `/api/wallet/etf/mint-request?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get ETF mint requests"
                );
            }

            return response.json() as Promise<{
                requests: EtfMintRequest[];
            }>;
        },
        enabled: !!partyId && !!issuer,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            mintRecipeCid: string;
            requester: string;
            amount: number;
            transferInstructionCids: string[];
            issuer: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/etf/mint-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create ETF mint request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [
                    "etfMintRequests",
                    variables.requester,
                    variables.issuer,
                ],
            });
        },
    });

    const accept = useMutation({
        mutationFn: async (params: {
            contractId: string;
            issuer: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/etf/mint-request/accept",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to accept ETF mint request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["etfMintRequests"],
            });
        },
    });

    const decline = useMutation({
        mutationFn: async (params: {
            contractId: string;
            issuer: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/etf/mint-request/decline",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to decline ETF mint request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["etfMintRequests"],
            });
        },
    });

    const withdraw = useMutation({
        mutationFn: async (params: {
            contractId: string;
            requester: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/etf/mint-request/withdraw",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to withdraw ETF mint request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["etfMintRequests"],
            });
        },
    });

    return {
        get,
        create,
        accept,
        decline,
        withdraw,
    };
}
