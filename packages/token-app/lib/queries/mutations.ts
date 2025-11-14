import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMintToken() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            tokenFactoryContractId: string;
            receiver: string;
            amount: number;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/mint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to mint token");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["tokenBalance", variables.receiver],
            });
        },
    });
}
