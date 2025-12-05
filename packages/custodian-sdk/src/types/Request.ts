import { ContractId } from "@denotecapital/token-sdk";

export interface Request<ContractParams = Record<string, unknown>> {
    contractId: ContractId;
    templateId: string;
    createArgument: ContractParams;
}
