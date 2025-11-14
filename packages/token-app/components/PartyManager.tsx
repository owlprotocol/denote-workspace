"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Party {
    name: string;
    partyId: string | null;
}

interface PartyManagerProps {
    onPartySelected?: (partyId: string, partyName: string) => void;
}

const PARTY_NAMES = ["alice", "bob"] as const;

export function PartyManager({ onPartySelected }: PartyManagerProps) {
    const [parties, setParties] = useState<Record<string, Party>>(() => {
        const initial: Record<string, Party> = {};
        PARTY_NAMES.forEach((name) => {
            initial[name] = {
                name,
                partyId: null,
            };
        });
        return initial;
    });
    const [activePartyId, setActivePartyId] = useState<string | null>(null);

    const createPartyMutation = useMutation({
        mutationFn: async (name: string) => {
            const response = await fetch("/api/wallet/party", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create party");
            }

            return response.json();
        },
        onSuccess: (data, name) => {
            const updatedParty = {
                name,
                partyId: data.partyId,
            };

            setParties((prev) => ({ ...prev, [name]: updatedParty }));

            setActivePartyId((currentActiveId) => {
                if (!currentActiveId) {
                    onPartySelected?.(data.partyId, name);
                    return data.partyId;
                }
                return currentActiveId;
            });

            toast.success(`Successfully created ${name} party`);
        },
        onError: (error, name) => {
            toast.error(
                `Failed to create ${name} party: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        },
    });

    const handleSwitchParty = (partyId: string, partyName: string) => {
        setActivePartyId(partyId);
        onPartySelected?.(partyId, partyName);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Party Management</CardTitle>
                <CardDescription>Create and manage parties</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {PARTY_NAMES.map((name, index) => {
                    const party = parties[name];
                    if (!party) return null;

                    const isActive = activePartyId === party.partyId;
                    const isCreating =
                        createPartyMutation.isPending &&
                        createPartyMutation.variables === name;
                    const hasParty = !!party.partyId;

                    return (
                        <div key={name}>
                            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div
                                        className={`p-2 rounded-full ${
                                            isActive
                                                ? "bg-primary/10"
                                                : "bg-muted"
                                        }`}
                                    >
                                        <User
                                            className={`h-4 w-4 ${
                                                isActive
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                            }`}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold capitalize">
                                                {name}
                                            </p>
                                            {isActive && (
                                                <Badge
                                                    variant="default"
                                                    className="gap-1"
                                                >
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate mt-1">
                                            {hasParty
                                                ? party.partyId
                                                : "Not created"}
                                        </p>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    {!hasParty ? (
                                        <Button
                                            onClick={() =>
                                                createPartyMutation.mutate(name)
                                            }
                                            disabled={isCreating}
                                            size="sm"
                                        >
                                            {isCreating ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                "Create"
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() =>
                                                handleSwitchParty(
                                                    party.partyId!,
                                                    party.name
                                                )
                                            }
                                            variant={
                                                isActive ? "default" : "outline"
                                            }
                                            size="sm"
                                        >
                                            {isActive ? "Active" : "Switch"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {index < PARTY_NAMES.length - 1 && (
                                <Separator className="my-4" />
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
