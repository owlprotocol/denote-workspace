"use client";

import { useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { EtfSetupSection } from "@/components/EtfSetupSection";
import { EtfCustodianView } from "@/components/EtfCustodianView";
import { EtfUserView } from "@/components/EtfUserView";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PARTIES = ["custodian", "alice"] as const;

export default function EtfPage() {
    const [selectedParty, setSelectedParty] = useState<string>("custodian");
    const [partyIds, setPartyIds] = useState<Record<string, string | null>>({
        custodian: null,
        alice: null,
    });
    const [setupComplete, setSetupComplete] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto max-w-4xl px-4 py-8 space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-4xl font-bold tracking-tight">
                            ETF Management
                        </h1>
                        <ConnectionStatus />
                    </div>

                    <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                        {PARTIES.map((party) => (
                            <Button
                                key={party}
                                variant={
                                    selectedParty === party
                                        ? "default"
                                        : "ghost"
                                }
                                onClick={() => setSelectedParty(party)}
                                className={cn(
                                    "capitalize",
                                    selectedParty === party && "shadow-sm"
                                )}
                            >
                                {party}
                            </Button>
                        ))}
                    </div>
                </div>

                <Separator />

                {!setupComplete && (
                    <EtfSetupSection
                        onSetupComplete={(result) => {
                            setSetupComplete(true);
                            setPartyIds({
                                custodian: result.parties.custodian,
                                alice: result.parties.alice,
                            });
                        }}
                    />
                )}

                {setupComplete &&
                    (selectedParty === "custodian" ? (
                        <EtfCustodianView
                            partyId={partyIds[selectedParty]!}
                            partyName={selectedParty}
                            allPartyIds={partyIds}
                        />
                    ) : (
                        <EtfUserView
                            partyId={partyIds[selectedParty]!}
                            partyName={selectedParty}
                            custodianPartyId={partyIds.custodian!}
                        />
                    ))}
            </main>
        </div>
    );
}
