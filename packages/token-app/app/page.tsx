"use client";

import { useEffect, useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PartyView } from "@/components/PartyView";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { loop } from "@fivenorth/loop-sdk";

const PARTIES = ["custodian", "alice", "bob"] as const;

export default function Home() {
    const [selectedParty, setSelectedParty] = useState<string>("custodian");
    const [partyIds, setPartyIds] = useState<Record<string, string | null>>({
        custodian: null,
        alice: null,
        bob: null,
    });
    const [provider, setProvider] = useState<any>(null);
    const handlePartyCreated = (partyId: string, partyName: string) => {
        setPartyIds((prev) => ({
            ...prev,
            [partyName]: partyId,
        }));
    };

    useEffect(() => {
        (async () => {
            await loop.init({
                appName: "My Awesome dApp",
                network: "devnet", // or 'devnet', 'mainnet'
                onTransactionUpdate: (payload: any) => {
                    console.log("Transaction update:", payload);
                },
                options: {
                    openMode: "popup", // 'popup' (default) or 'tab'
                    requestSigningMode: "popup", // 'popup' (default) or 'tab'
                    redirectUrl: "http://localhost:3001/", // optional redirect after approval
                },
                onAccept: (provider: any) => {
                    console.log("Connected!", provider);
                    setProvider(provider);
                    // You can now use the provider to interact with the wallet
                },
                onReject: () => {
                    console.log("Connection rejected by user.");
                },
            });
        })();
    }, []);

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
                    <Button
                        onClick={async () => {
                            await loop.connect();
                            console.log("Loop connected");
                        }}
                    >
                        Connect
                    </Button>
                    <Button
                        onClick={async () => {
                            if (!provider) return;
                            await provider.signMessage("Hello, Loop!");
                        }}
                    >
                        Sign Message
                    </Button>
                    <Button
                        onClick={async () => {
                            if (!provider) return;
                            try {
                                const params = new URLSearchParams({
                                    issuer: provider.party_id,
                                    instrumentId: "TokenFactory",
                                });
                                const response = await fetch(
                                    `/api/wallet/token-factory/command?${params}`
                                );

                                if (!response.ok) {
                                    throw new Error(
                                        `Failed to create command: ${response.statusText}`
                                    );
                                }

                                const { command } = await response.json();

                                await provider.submitTransaction(
                                    { commands: [command] },
                                    {
                                        message: "Create Token Factory",
                                    }
                                );
                            } catch (error) {
                                console.error(
                                    "Error creating token factory:",
                                    error
                                );
                            }
                        }}
                    >
                        Create Token Factory
                    </Button>

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
                        <Link href="/bond">
                            <Button variant="outline">Bond Demo</Button>
                        </Link>
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
