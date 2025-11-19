"use client";

import { useState } from "react";
import { useSendTransferWithPreapproval } from "@/lib/queries/transferPreapproval";
import { useTransferPreapproval } from "@/lib/queries/transferPreapproval";
import { useBalance } from "@/lib/queries/balance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SendTransferProps {
    partyId: string;
    partyName: string;
    instrumentId: string;
    availablePartyIds: string[];
}

export function SendTransfer({
    partyId,
    partyName,
    instrumentId,
    availablePartyIds,
}: SendTransferProps) {
    const [receiverPartyId, setReceiverPartyId] = useState("");
    const [amount, setAmount] = useState(10);

    const { data: preapproval } = useTransferPreapproval(
        partyId,
        receiverPartyId || "",
        instrumentId,
        partyName
    );

    const { data: balance } = useBalance(
        partyId,
        partyId && instrumentId ? { admin: partyId, id: instrumentId } : null
    );

    const sendMutation = useSendTransferWithPreapproval();

    const handleSend = async () => {
        if (
            !receiverPartyId ||
            !preapproval?.contractId ||
            !balance?.utxos.length
        ) {
            toast.error("Missing required information");
            return;
        }

        if (amount <= 0 || amount > (balance.total || 0)) {
            toast.error("Invalid amount");
            return;
        }

        try {
            await sendMutation.mutateAsync({
                transferPreapprovalContractId: preapproval.contractId,
                tokenCid: balance.utxos[0].contractId,
                sender: partyId,
                amount,
                seed: partyName,
            });
            toast.success(`Successfully sent ${amount} tokens!`);
            setAmount(10);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to send transfer"
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Send Tokens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="receiverPartyId">Receiver</Label>
                    {availablePartyIds.length > 0 ? (
                        <select
                            id="receiverPartyId"
                            value={receiverPartyId}
                            onChange={(e) => setReceiverPartyId(e.target.value)}
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
                <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.valueAsNumber || 0)}
                        min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                        Balance: {balance?.total ?? 0} tokens
                    </p>
                </div>

                <Button
                    onClick={handleSend}
                    disabled={
                        sendMutation.isPending ||
                        !preapproval?.contractId ||
                        !balance?.utxos.length ||
                        !receiverPartyId
                    }
                    className="w-full"
                    size="lg"
                >
                    {sendMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        "Send Tokens"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
