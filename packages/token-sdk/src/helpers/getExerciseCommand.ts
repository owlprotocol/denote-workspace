import { WrappedCommand } from "@canton-network/wallet-sdk";
import { ContractId } from "../types/daml.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getExerciseCommand = <Params extends Record<string, any>>({
    templateId,
    contractId,
    choice,
    params,
}: {
    templateId: string;
    contractId: ContractId;
    choice: string;
    params: Params;
}): WrappedCommand => ({
    ExerciseCommand: {
        templateId,
        contractId,
        choice,
        choiceArgument: params,
    },
});
