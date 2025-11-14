"use client";

import { useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PartyManager } from "@/components/PartyManager";
import { TokenOperations } from "@/components/TokenOperations";
import { Separator } from "@/components/ui/separator";

export default function Home() {
    const [activePartyId, setActivePartyId] = useState<string | null>(null);
    const [activePartyName, setActivePartyName] = useState<string | null>(null);

    const handlePartySelected = (partyId: string, partyName: string) => {
        setActivePartyId(partyId);
        setActivePartyName(partyName);
    };

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Token Management
                    </h1>
                </div>

                <ConnectionStatus />

                <Separator />

                <div className="grid gap-6 lg:grid-cols-2">
                    <PartyManager onPartySelected={handlePartySelected} />
                    <TokenOperations
                        activePartyId={activePartyId}
                        activePartyName={activePartyName}
                    />
                </div>
            </main>
        </div>
    );
}
