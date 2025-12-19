import { ContractId } from "./daml.js";

export type WithContractId<ContractParams = Record<string, unknown>> =
    ContractParams & {
        contractId: ContractId;
    };
