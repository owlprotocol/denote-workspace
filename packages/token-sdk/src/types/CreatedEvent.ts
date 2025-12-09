import { Types } from "@canton-network/core-ledger-client";

export type CreatedEvent<ContractParams = Record<string, unknown>> = {
    createArgument: ContractParams;
} & Types["CreatedEvent"];
