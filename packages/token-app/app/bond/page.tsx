"use client";

import { useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { BondPartyView } from "@/components/BondPartyView";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PARTIES = ["custodian", "alice"] as const;

export default function BondPage() {
    const [selectedParty, setSelectedParty] = useState<string>("custodian");
    const [partyIds, setPartyIds] = useState<Record<string, string | null>>({
        custodian: null,
        alice: null,
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
                            Bond Lifecycle Demo
                        </h1>
                        <ConnectionStatus />
                    </div>

                    <div className="flex items-center gap-4">
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
                        <Link href="/">
                            <Button variant="outline">Simple Tokens</Button>
                        </Link>
                    </div>
                </div>

                <Separator />

                <BondPartyView
                    partyName={selectedParty}
                    partyId={partyIds[selectedParty]}
                    allPartyIds={partyIds}
                    onPartyCreated={handlePartyCreated}
                />
            </main>
        </div>
    );
}
