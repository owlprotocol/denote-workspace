import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useTransferPreapprovalProposals(
    partyId: string | null,
    type: "sent" | "received"
) {
    return useQuery({
        queryKey: ["transferPreapprovalProposals", partyId, type],
        queryFn: async () => {
            if (!partyId) throw new Error("Party ID required");

            const params = new URLSearchParams({
                partyId,
                type,
            });

            const response = await fetch(
                `/api/wallet/transfer-preapproval-proposals?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get proposals");
            }

            return response.json();
        },
        enabled: !!partyId,
        refetchInterval: 5000,
    });
}

export function useTransferPreapproval(
    issuer: string | null,
    receiver: string | null,
    instrumentId: string,
    issuerName: string
) {
    return useQuery({
        queryKey: ["transferPreapproval", issuer, receiver, instrumentId],
        queryFn: async () => {
            if (!issuer || !receiver || !instrumentId)
                throw new Error("Missing parameters");

            const params = new URLSearchParams({
                issuer,
                receiver,
                instrumentId,
            });

            const response = await fetch(
                `/api/wallet/transfer-preapproval?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get preapproval");
            }

            return response.json();
        },
        enabled: !!issuer && !!receiver && !!instrumentId,
        refetchInterval: 5000,
    });
}

export function useCreateTransferPreapprovalProposal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            receiver: string;
            instrumentId: string;
            seed: string;
            issuer: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-preapproval-proposals",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create proposal");
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferPreapprovalProposals"],
            });
        },
    });
}

export function useAcceptTransferPreapprovalProposal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            transferPreapprovalProposalContractId: string;
            seed: string;
            receiver: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-preapproval-proposals/accept",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to accept proposal");
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferPreapprovalProposals"],
            });
            queryClient.invalidateQueries({
                queryKey: ["transferPreapproval"],
            });
        },
    });
}

export function useSendTransferWithPreapproval() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            transferPreapprovalContractId: string;
            tokenCid: string;
            sender: string;
            amount: number;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/transfer-preapproval", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to send transfer");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["tokenBalance", variables.sender],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances", variables.sender],
            });
        },
    });
}
