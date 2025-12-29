"use client";

import { useState } from "react";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { useAllBalancesForAllInstruments } from "@/lib/queries/allBalances";
import { EtfPortfolioComposition } from "./EtfPortfolioComposition";
import { EtfMintRecipe } from "./EtfMintRecipe";
import { EtfMintRequestManagement } from "./EtfMintRequestManagement";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface EtfCustodianViewProps {
    partyId: string;
    partyName: string;
    allPartyIds: Record<string, string | null>;
}

export function EtfCustodianView({
    partyId,
    partyName,
    allPartyIds,
}: EtfCustodianViewProps) {
    const [selectedInstrumentForBalances, setSelectedInstrumentForBalances] =
        useState<string | null>(null);

    const tokenFactory = useTokenFactory(partyId);
    const instruments = tokenFactory.getInstruments.data?.instruments || [];

    const {
        allBalances,
        isLoadingBalances,
        hasBalanceError,
        balanceQueries,
        setupInstruments,
    } = useAllBalancesForAllInstruments(partyId, instruments);

    const allBalancesList = selectedInstrumentForBalances
        ? balanceQueries[
              setupInstruments.findIndex(
                  (inst) => inst.instrumentId === selectedInstrumentForBalances
              )
          ]?.data?.balances ?? []
        : allBalances;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Minted Tokens Summary</CardTitle>
                    <CardDescription>
                        View token balances by instrument
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {setupInstruments.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="balanceInstrumentSelect">
                                Select Instrument
                            </Label>
                            <select
                                id="balanceInstrumentSelect"
                                value={selectedInstrumentForBalances || ""}
                                onChange={(e) =>
                                    setSelectedInstrumentForBalances(
                                        e.target.value || null
                                    )
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">All Instruments</option>
                                {setupInstruments.map((instrument) => (
                                    <option
                                        key={instrument.instrumentId}
                                        value={instrument.instrumentId}
                                    >
                                        {instrument.instrumentId.split("#")[1]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {isLoadingBalances ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : hasBalanceError ? (
                        <p className="text-sm text-muted-foreground">
                            Unable to load balances. Token factory may not be
                            set up yet.
                        </p>
                    ) : allBalancesList.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {selectedInstrumentForBalances
                                ? "No tokens minted yet for this instrument"
                                : "No tokens minted yet"}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {allBalancesList.map((balance) => {
                                const instrumentName =
                                    selectedInstrumentForBalances
                                        ? selectedInstrumentForBalances.split(
                                              "#"
                                          )[1]
                                        : null;

                                return (
                                    <div
                                        key={balance.party}
                                        className="p-3 rounded-lg border flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {balance.party}
                                            </p>
                                            {instrumentName && (
                                                <p className="text-xs text-muted-foreground">
                                                    {instrumentName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">
                                                {balance.total} tokens
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <EtfPortfolioComposition partyId={partyId} partyName={partyName} />
            <EtfMintRecipe
                partyId={partyId}
                partyName={partyName}
                allPartyIds={allPartyIds}
            />
            <EtfMintRequestManagement partyId={partyId} partyName={partyName} />
            {/* TODO: Add ETF burn section */}
        </div>
    );
}
