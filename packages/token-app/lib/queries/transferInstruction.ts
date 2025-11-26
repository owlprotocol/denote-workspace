import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TransferInstruction {
    contractId: string;
    transfer: {
        sender: string;
        receiver: string;
        amount: number;
        instrumentId: {
            admin: string;
            id: string;
        };
    };
}

export function useTransferInstruction(partyId: string | null) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["transferInstructions", partyId],
        queryFn: async () => {
            if (!partyId) throw new Error("Party ID required");

            const response = await fetch(
                `/api/wallet/transfer-instruction?partyId=${partyId}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get transfer instructions"
                );
            }

            return response.json() as Promise<{
                instructions: TransferInstruction[];
            }>;
        },
        enabled: !!partyId,
        refetchInterval: 5000,
    });

    const getDisclosure = useMutation({
        mutationFn: async (params: {
            transferInstructionCid: string;
            adminPartyId: string;
        }) => {
            const response = await fetch(
                `/api/wallet/transfer-instruction/disclosure?transferInstructionCid=${params.transferInstructionCid}&adminPartyId=${params.adminPartyId}`,
                {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get disclosure");
            }

            return response.json();
        },
    });

    const accept = useMutation({
        mutationFn: async (params: {
            contractId: string;
            disclosure: unknown;
            receiverPartyId: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-instruction/accept",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to accept transfer instruction"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferInstructions"],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
        },
    });

    const reject = useMutation({
        mutationFn: async (params: {
            contractId: string;
            disclosure: unknown;
            receiverPartyId: string;
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/transfer-instruction/reject",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to reject transfer instruction"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["transferInstructions"],
            });
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
        },
    });

    return {
        get,
        getDisclosure,
        accept,
        reject,
    };
}
