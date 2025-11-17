import { Types } from "@canton-network/core-ledger-client";

export type ActiveContractResponse<ContractParams = Record<string, unknown>> =
    Types["JsGetActiveContractsResponse"] & {
        contractEntry: {
            JsActiveContract?: {
                createdEvent: {
                    createArgument: ContractParams;
                };
            };
        };
    };
