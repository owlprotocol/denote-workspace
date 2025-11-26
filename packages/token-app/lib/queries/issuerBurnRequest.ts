import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface IssuerBurnRequest {
    contractId: string;
    tokenFactoryCid: string;
    issuer: string;
    owner: string;
    amount: number;
    inputHoldingCid: string;
}

export function useIssuerBurnRequest(
    partyId: string | null,
    issuer: string | null
) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["issuerBurnRequests", partyId, issuer],
        queryFn: async () => {
            if (!partyId || !issuer)
                throw new Error("Party ID and issuer required");

            const params = new URLSearchParams({
                partyId,
                issuer,
            });

            const response = await fetch(`/api/wallet/burn-request?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get issuer burn requests"
                );
            }

            return response.json() as Promise<{
                requests: IssuerBurnRequest[];
            }>;
        },
        enabled: !!partyId && !!issuer,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            tokenFactoryCid: string;
            issuer: string;
            owner: string;
            amount: number;
            inputHoldingCid: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/burn-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create issuer burn request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [
                    "issuerBurnRequests",
                    variables.owner,
                    variables.issuer,
                ],
            });
            queryClient.invalidateQueries({
                queryKey: [
                    "issuerBurnRequests",
                    variables.issuer,
                    variables.issuer,
                ],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
        },
    });

    const accept = useMutation({
        mutationFn: async (params: {
            contractId: string;
            issuerPartyId: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/burn-request/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to accept issuer burn request"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["issuerBurnRequests"],
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
            const response = await fetch("/api/wallet/burn-request/decline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to decline issuer burn request"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["issuerBurnRequests"],
            });
        },
    });

    const withdraw = useMutation({
        mutationFn: async (params: {
            contractId: string;
            ownerPartyId: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/burn-request/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to withdraw issuer burn request"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["issuerBurnRequests"],
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
