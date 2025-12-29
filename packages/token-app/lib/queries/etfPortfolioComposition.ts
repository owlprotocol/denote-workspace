import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PortfolioItem {
    instrumentId: {
        admin: string;
        id: string;
    };
    weight: number;
}

export interface PortfolioComposition {
    contractId: string;
    owner: string;
    name: string;
    items: PortfolioItem[];
}

export function useEtfPortfolioComposition(owner: string | null) {
    const queryClient = useQueryClient();

    const get = useQuery({
        queryKey: ["etfPortfolioCompositions", owner],
        queryFn: async () => {
            if (!owner) {
                throw new Error("Owner required");
            }

            const params = new URLSearchParams({
                owner,
            });

            const response = await fetch(
                `/api/wallet/etf/portfolio-composition?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get portfolio compositions"
                );
            }

            return response.json() as Promise<{
                compositions: PortfolioComposition[];
            }>;
        },
        enabled: !!owner,
        refetchInterval: 5000,
    });

    const create = useMutation({
        mutationFn: async (params: {
            owner: string;
            name: string;
            items: PortfolioItem[];
            seed: string;
        }) => {
            const response = await fetch(
                "/api/wallet/etf/portfolio-composition",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create portfolio composition"
                );
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["etfPortfolioCompositions", variables.owner],
            });
        },
    });

    return {
        get,
        create,
    };
}
