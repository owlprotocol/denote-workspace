import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface MintRecipe {
    contractId: string;
    issuer: string;
    instrumentId: string;
    authorizedMinters: string[];
    composition: string;
}

export function useEtfMintRecipe(issuer: string | null) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["etfMintRecipes", issuer],
        queryFn: async () => {
            if (!issuer) {
                throw new Error("Issuer required");
            }

            const params = new URLSearchParams({
                issuer,
            });

            const response = await fetch(
                `/api/wallet/etf/mint-recipe?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get mint recipes");
            }

            return response.json() as Promise<{
                recipes: MintRecipe[];
            }>;
        },
        enabled: !!issuer,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            issuer: string;
            instrumentId: string;
            authorizedMinters: string[];
            composition: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/etf/mint-recipe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create mint recipe");
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["etfMintRecipes", variables.issuer],
            });
        },
    });

    return {
        get,
        create,
    };
}
