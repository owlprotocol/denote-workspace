import { useQuery } from "@tanstack/react-query";

export function useTokenFactory(
    instrumentId: string,
    seed: string,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: ["tokenFactory", instrumentId],
        queryFn: async () => {
            const response = await fetch("/api/wallet/token-factory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instrumentId, seed }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get token factory");
            }

            const data = await response.json();
            return data.tokenFactoryContractId;
        },
        enabled: enabled && !!instrumentId && !!seed,
        staleTime: 5 * 60 * 1000,
    });
}
