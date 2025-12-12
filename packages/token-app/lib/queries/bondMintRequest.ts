import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface BondMintRequest {
    contractId: string;
    instrumentCid: string;
    issuer: string;
    receiver: string;
    amount: number;
}

export function useBondMintRequest() {
    const queryClient = useQueryClient();

    const create = useMutation({
        mutationFn: async (params: {
            instrumentCid: string;
            issuer: string;
            receiver: string;
            amount: number;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/bond/mint-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create bond mint request"
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["balances"],
            });
        },
    });

    return { create };
}
