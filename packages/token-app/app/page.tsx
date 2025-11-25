"use client";

import { useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PartyView } from "@/components/PartyView";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PARTIES = ["charlie", "alice", "bob"] as const;

export default function Home() {
    const [selectedParty, setSelectedParty] = useState<string>("charlie");
    const [partyIds, setPartyIds] = useState<Record<string, string | null>>({
        charlie: null,
        alice: null,
        bob: null,
    });

    const handlePartyCreated = (partyId: string, partyName: string) => {
        setPartyIds((prev) => ({
            ...prev,
            [partyName]: partyId,
        }));
    };

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto max-w-4xl px-4 py-8 space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-4xl font-bold tracking-tight">
                            Token Management
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

                <PartyView
                    partyName={selectedParty}
                    partyId={partyIds[selectedParty]}
                    allPartyIds={partyIds}
                    onPartyCreated={handlePartyCreated}
                />
            </main>
        </div>
    );
}
