import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Instrument {
    name: string;
    instrumentId: string;
    custodianPartyId: string;
    tokenFactoryCid?: string;
}

export interface TokenFactorySetupResult {
    rulesCid: string;
    transferFactoryCid: string;
    tokenFactoryCid: string;
}

export function useTokenFactory(admin: string | null) {
    const queryClient = useQueryClient();

    const getTokenRules = useQuery({
        queryKey: ["tokenRules", admin],
        queryFn: async () => {
            if (!admin) {
                throw new Error("Admin required");
            }

            const params = new URLSearchParams({
                admin,
            });

            const response = await fetch(`/api/wallet/token-rules?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get token rules");
            }

            return response.json() as Promise<{ rulesCid: string }>;
        },
        enabled: !!admin,
    });

    const getTransferFactory = useQuery({
        queryKey: ["transferFactory", admin, getTokenRules.data?.rulesCid],
        queryFn: async () => {
            if (!admin || !getTokenRules.data?.rulesCid) {
                throw new Error("Admin and rulesCid required");
            }

            const params = new URLSearchParams({
                admin,
                rulesCid: getTokenRules.data.rulesCid,
            });

            const response = await fetch(
                `/api/wallet/transfer-factory?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get transfer factory"
                );
            }

            return response.json() as Promise<{ transferFactoryCid: string }>;
        },
        enabled: !!admin && !!getTokenRules.data?.rulesCid,
    });

    const getInstruments = useQuery({
        queryKey: ["instruments", admin],
        queryFn: async () => {
            if (!admin) {
                throw new Error("Custodian party ID required");
            }

            const params = new URLSearchParams({
                custodianPartyId: admin,
            });

            const response = await fetch(`/api/wallet/token-factory?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get instruments");
            }

            return response.json() as Promise<{
                instruments: Instrument[];
            }>;
        },
        enabled: !!admin,
        refetchInterval: 5000,
    });

    const setup = useMutation({
        mutationFn: async (params: {
            partyId: string;
            instrumentId: string;
            seed: string;
        }) => {
            const response = await fetch("/api/wallet/token-factory/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to setup token factory");
            }

            return response.json() as Promise<TokenFactorySetupResult>;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["tokenRules", variables.partyId],
            });
            queryClient.invalidateQueries({
                queryKey: ["transferFactory", variables.partyId],
            });
        },
    });

    return {
        getTokenRules,
        getTransferFactory,
        getInstruments,
        setup,
    };
}
