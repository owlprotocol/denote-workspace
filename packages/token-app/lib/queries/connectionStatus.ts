import { useQuery } from "@tanstack/react-query";

export function useConnectionStatus() {
    return useQuery({
        queryKey: ["connectionStatus"],
        queryFn: async () => {
            const response = await fetch("/api/wallet/status");

            if (!response.ok) {
                throw new Error("Failed to check connection status");
            }

            return response.json();
        },
        refetchInterval: 5000,
        staleTime: 2000,
    });
}
