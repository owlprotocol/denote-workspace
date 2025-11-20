import { WrappedCommand } from "@canton-network/wallet-sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCreateCommand = <Params extends Record<string, any>>({
    templateId,
    params,
}: {
    templateId: string;
    params: Params;
}): WrappedCommand => ({
    CreateCommand: {
        templateId,
        createArguments: params,
    },
});
