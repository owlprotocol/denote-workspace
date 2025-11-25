import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface IssuerMintRequest {
    contractId: string;
    tokenFactoryCid: string;
    issuer: string;
    receiver: string;
    amount: number;
}

export function useIssuerMintRequest(
    partyId: string | null,
    issuer: string | null
) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["issuerMintRequests", partyId, issuer],
        queryFn: async () => {
            if (!partyId || !issuer)
                throw new Error("Party ID and issuer required");

            const params = new URLSearchParams({
                partyId,
                issuer,
            });

            const response = await fetch(`/api/wallet/mint-request?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get issuer mint requests"
                );
            }

            return response.json() as Promise<{
                requests: IssuerMintRequest[];
            }>;
        },
        enabled: !!partyId && !!issuer,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            tokenFactoryCid: string;
            issuer: string;
            receiver: string;
            amount: number;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/mint-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create issuer mint request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [
                    "issuerMintRequests",
                    variables.receiver,
                    variables.issuer,
                ],
            });
            queryClient.invalidateQueries({
                queryKey: [
                    "issuerMintRequests",
                    variables.issuer,
                    variables.issuer,
                ],
            });
        },
    });

    const accept = useMutation({
        mutationFn: async (params: {
            contractId: string;
            issuerPartyId: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/mint-request/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to accept issuer mint request"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["issuerMintRequests"],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
        },
    });

    const decline = useMutation({
        mutationFn: async (params: {
            contractId: string;
            issuerPartyId: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/mint-request/decline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to decline issuer mint request"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["issuerMintRequests"],
            });
        },
    });

    return {
        get,
        create,
        accept,
        decline,
    };
}
