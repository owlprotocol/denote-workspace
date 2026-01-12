"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EtfSetupSectionProps {
    onSetupComplete?: (result: any) => void;
}

export function EtfSetupSection({ onSetupComplete }: EtfSetupSectionProps) {
    const setupMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch("/api/wallet/etf/setup", {
                method: "POST",
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to run ETF setup");
            }

            return response.json();
        },
        onSuccess: (data) => {
            onSetupComplete?.(data);
            toast.success("ETF setup completed successfully!");
        },
        onError: (error) => {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to run ETF setup"
            );
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>ETF Setup</CardTitle>
            </CardHeader>
            <CardContent>
                <Button
                    onClick={() => setupMutation.mutate()}
                    disabled={setupMutation.isPending}
                    className="w-full"
                >
                    {setupMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        "Setup ETF Environment"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
