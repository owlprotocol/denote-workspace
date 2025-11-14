import { useQuery } from "@tanstack/react-query";

export function useBalance(
    owner: string,
    instrumentId: { admin: string; id: string } | null
) {
    return useQuery({
        queryKey: ["tokenBalance", owner, instrumentId],
        queryFn: async () => {
            if (!instrumentId) throw new Error("Instrument ID required");

            const params = new URLSearchParams({
                owner,
                admin: instrumentId.admin,
                id: instrumentId.id,
            });

            const response = await fetch(`/api/wallet/balance?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get balance");
            }

            return response.json();
        },
        enabled: !!owner && !!instrumentId?.admin && !!instrumentId?.id,
        refetchInterval: 5000,
    });
}
