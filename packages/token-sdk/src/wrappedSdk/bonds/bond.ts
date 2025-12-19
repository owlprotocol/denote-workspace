import { LedgerController } from "@canton-network/wallet-sdk";
import { ContractId } from "../../types/daml.js";
import { bondTemplateId } from "../../constants/templateIds.js";
import { getCreatedEventByCid } from "../../helpers/getCreatedEventByCid.js";

export interface BondParams {
    issuer: string;
    depository: string;
    owner: string;
    instrumentId: string;
    version: string;
    notional: number;
    amount: number;
    maturityDate: string;
    couponRate: number;
    couponFrequency: number;
    issueDate: string;
    lastEventTimestamp: string;
}

export async function getBondContract(
    ledger: LedgerController,
    contractId: ContractId
): Promise<BondParams | undefined> {
    try {
        const event = await getCreatedEventByCid<BondParams>(
            ledger,
            contractId,
            bondTemplateId
        );
        return event?.createArgument;
    } catch (error) {
        if (error instanceof Error) {
            return undefined;
        }
        return undefined;
    }
}
