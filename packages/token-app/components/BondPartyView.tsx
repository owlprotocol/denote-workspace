"use client";

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
import { Loader2, Copy, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BondCustodianView } from "./BondCustodianView";
import { BondUserView } from "./BondUserView";

interface BondPartyViewProps {
    partyName: string;
    partyId: string | null;
    allPartyIds: Record<string, string | null>;
    onPartyCreated?: (partyId: string, partyName: string) => void;
}

export function BondPartyView({
    partyName,
    partyId,
    allPartyIds,
    onPartyCreated,
}: BondPartyViewProps) {
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
            onPartyCreated?.(data.partyId, name);
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    if (!partyId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {partyName.charAt(0).toUpperCase() + partyName.slice(1)}
                    </CardTitle>
                    <CardDescription>
                        Create a party to start managing bonds
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={() => createPartyMutation.mutate(partyName)}
                        disabled={createPartyMutation.isPending}
                        className="w-full"
                        size="lg"
                    >
                        {createPartyMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <User className="mr-2 h-4 w-4" />
                                Create Party
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const custodianPartyId = allPartyIds.custodian;
    const isCustodian = partyId === custodianPartyId;

    const PartyInfoCard = () => (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {partyName.charAt(0).toUpperCase() +
                                partyName.slice(1)}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Party information and status
                        </CardDescription>
                    </div>
                    <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Party ID</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md break-all">
                            {partyId}
                        </code>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(partyId!)}
                            className="shrink-0"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <PartyInfoCard />
            {isCustodian ? (
                <BondCustodianView partyId={partyId} partyName={partyName} />
            ) : (
                <BondUserView
                    partyId={partyId}
                    partyName={partyName}
                    custodianPartyId={custodianPartyId}
                />
            )}
        </div>
    );
}
