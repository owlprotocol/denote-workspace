import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TransferRequest {
    contractId: string;
    transferFactoryCid: string;
    expectedAdmin: string;
    transfer: {
        sender: string;
        receiver: string;
        amount: number;
        instrumentId: {
            admin: string;
            id: string;
        };
        requestedAt: string;
        executeBefore: string;
        inputHoldingCids: string[];
    };
}

export function useTransferRequest(
    partyId: string | null,
    expectedAdmin: string | null
) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["transferRequests", partyId, expectedAdmin],
        queryFn: async () => {
            if (!partyId || !expectedAdmin)
                throw new Error("Party ID and expectedAdmin required");

            const params = new URLSearchParams({
                partyId,
                expectedAdmin,
            });

            const response = await fetch(
                `/api/wallet/transfer-request?${params}`
            );

            if (!response.ok) {
                const error = (await response.json()) as { error?: string };
                throw new Error(
                    error.error ?? "Failed to get transfer requests"
                );
            }

            return response.json() as Promise<{
                requests: TransferRequest[];
            }>;
        },
        enabled: !!partyId && !!expectedAdmin,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            transferFactoryCid: string;
            expectedAdmin: string;
            sender: string;
            receiver: string;
            amount: number;
            instrumentId: { admin: string; id: string };
            inputHoldingCids: string[];
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/transfer-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create transfer request"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["transferRequests", variables.sender],
            });
            queryClient.invalidateQueries({
                queryKey: ["transferRequests", variables.expectedAdmin],
            });
        },
    });

    const accept = useMutation({
        mutationFn: async (params: {
            contractId: string;
            adminPartyId: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-request/accept",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = (await response.json()) as { error?: string };
                throw new Error(
                    error.error ?? "Failed to accept transfer request"
                );
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferRequests"],
            });
            queryClient.invalidateQueries({
                queryKey: ["transferInstructions"],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
        },
    });

    const decline = useMutation({
        mutationFn: async (params: {
            contractId: string;
            adminPartyId: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-request/decline",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = (await response.json()) as { error?: string };
                throw new Error(
                    error.error ?? "Failed to decline transfer request"
                );
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferRequests"],
            });
        },
    });

    const withdraw = useMutation({
        mutationFn: async (params: {
            contractId: string;
            senderPartyId: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-request/withdraw",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = (await response.json()) as { error?: string };
                throw new Error(
                    error.error ?? "Failed to withdraw transfer request"
                );
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferRequests"],
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
