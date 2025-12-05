import { Types } from "@canton-network/core-ledger-client";
import { CreatedEvent } from "./CreatedEvent.js";

export type ActiveContractResponse<ContractParams = Record<string, unknown>> =
    Types["JsGetActiveContractsResponse"] & {
        contractEntry: {
            JsActiveContract?: {
                createdEvent: CreatedEvent<ContractParams>;
            };
        };
    };
