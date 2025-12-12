import { useQuery } from "@tanstack/react-query";

export interface BondInstrument {
    name: string;
    instrumentId: string;
    custodianPartyId: string;
    bondInstrumentCid: string;
    maturityDate: string;
    couponRate: number;
    couponFrequency: number;
}

export function useBondInstruments(custodianPartyId: string | null) {
    return useQuery<BondInstrument[]>({
        queryKey: ["bondInstruments", custodianPartyId],
        queryFn: async () => {
            if (!custodianPartyId)
                throw new Error("Custodian party ID required");

            const params = new URLSearchParams({
                custodianPartyId: custodianPartyId,
            });
            const response = await fetch(
                `/api/wallet/bond/factory/instruments?${params}`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get bond instruments"
                );
            }

            const data = await response.json();
            return data.instruments as BondInstrument[];
        },
        enabled: !!custodianPartyId,
        refetchInterval: 5000,
    });
}
