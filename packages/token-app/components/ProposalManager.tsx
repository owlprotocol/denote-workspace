"use client";

import { useState } from "react";
import { useCreateTransferPreapprovalProposal } from "@/lib/queries/transferPreapproval";
import { useTransferPreapprovalProposals } from "@/lib/queries/transferPreapproval";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProposalManagerProps {
    partyId: string;
    partyName: string;
    instrumentId: string;
    availablePartyIds: string[];
}

export function ProposalManager({
    partyId,
    partyName,
    instrumentId,
    availablePartyIds,
}: ProposalManagerProps) {
    const [receiverPartyId, setReceiverPartyId] = useState("");

    const { data: sentProposals } = useTransferPreapprovalProposals(
        partyId,
        "sent"
    );

    const createProposalMutation = useCreateTransferPreapprovalProposal();

    const handleCreateProposal = async () => {
        if (!receiverPartyId.trim()) {
            toast.error("Please enter a receiver party ID");
            return;
        }

        try {
            await createProposalMutation.mutateAsync({
                receiver: receiverPartyId.trim(),
                instrumentId,
                seed: partyName,
                issuer: partyId,
            });
            toast.success("Transfer preapproval proposal created");
            setReceiverPartyId("");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create proposal"
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transfer Preapproval Proposals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="receiverPartyId">
                            Receiver Party ID
                        </Label>
                        {availablePartyIds.length > 0 ? (
                            <select
                                id="receiverPartyId"
                                value={receiverPartyId}
                                onChange={(e) =>
                                    setReceiverPartyId(e.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">Select party...</option>
                                {availablePartyIds.map((id) => (
                                    <option key={id} value={id}>
                                        {id}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No other parties available
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleCreateProposal}
                        disabled={
                            createProposalMutation.isPending ||
                            !receiverPartyId.trim()
                        }
                        className="w-full"
                    >
                        {createProposalMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Proposal"
                        )}
                    </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                    <Label>Sent Proposals</Label>
                    {sentProposals?.proposals?.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No proposals sent yet
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {sentProposals?.proposals?.map((proposal: any) => (
                                <div
                                    key={proposal.contractId}
                                    className="p-3 rounded-lg border"
                                >
                                    <p className="text-sm font-medium">
                                        To: {proposal.receiver}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {proposal.instrumentId}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
