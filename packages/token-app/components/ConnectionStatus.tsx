"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useConnectionStatus } from "@/lib/queries/connectionStatus";

export function ConnectionStatus() {
    const { data, isLoading, error } = useConnectionStatus();
    const isConnected = data?.connected ?? false;
    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Checking...</span>
                </Badge>
            </div>
        );
    }

    if (error || !isConnected) {
        return (
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-2">
                    <XCircle className="h-3 w-3 text-destructive" />
                    <span>Disconnected</span>
                </Badge>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
                <CheckCircle2 className="h-3 w-3 text-success" />
                <span>Connected</span>
            </Badge>
        </div>
    );
}
