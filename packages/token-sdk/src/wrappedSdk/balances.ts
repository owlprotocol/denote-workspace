import {
    PrettyContract,
    Holding,
    Types,
} from "@canton-network/core-ledger-client";
import { WalletSDK, LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId, Party } from "../types/daml.js";

export interface InstrumentId {
    admin: Party;
    id: string;
}

export const formatHoldingUtxo = (utxo: PrettyContract<Holding>) => {
    const { amount, owner, instrumentId } = utxo.interfaceViewValue;
    return {
        amount,
        owner,
        instrumentId,
        contractId: utxo.contractId,
    };
};
const instrumentIdToString = (instrumentId: InstrumentId) =>
    `${instrumentId.admin}:${instrumentId.id}`;
export interface TokenBalance {
    total: number;
    utxos: { amount: number; contractId: ContractId }[];
}

export async function getBalances(
    sdk: WalletSDK,
    owner: Party
): Promise<Record<ContractId, TokenBalance>> {
    if (!sdk.tokenStandard) {
        throw new Error("Token standard SDK not initialized");
    }

    const utxosUnformatted = await sdk.tokenStandard.listHoldingUtxos(false);
    const utxos = utxosUnformatted
        .filter((u) => u.interfaceViewValue.owner === owner)
        .map(formatHoldingUtxo);

    const balances: Record<
        ContractId,
        {
            total: number;
            utxos: { amount: number; contractId: ContractId }[];
        }
    > = {};

    utxos.forEach((utxo) => {
        const instrumentId = instrumentIdToString(utxo.instrumentId);
        if (!balances[instrumentId]) {
            balances[instrumentId] = { total: 0, utxos: [] };
        }

        const amount = Number(utxo.amount);

        balances[instrumentId].total += amount;
        balances[instrumentId].utxos.push({
            amount,
            contractId: utxo.contractId,
        });
    });

    return balances;
}

export interface GetBalanceByInstrumentIdParams {
    owner: Party;
    instrumentId: { admin: Party; id: string };
}

export async function getBalanceByInstrumentId(
    sdk: WalletSDK,
    { owner, instrumentId }: GetBalanceByInstrumentIdParams
): Promise<TokenBalance> {
    const balances = await getBalances(sdk, owner);
    const instrumentIdStr = instrumentIdToString(instrumentId);
    return balances[instrumentIdStr] ?? { total: 0, utxos: [] };
}

export async function getContractDisclosure(
    userLedger: LedgerController,
    { templateId, contractId }: { templateId: string; contractId: ContractId }
): Promise<Types["DisclosedContract"]> {
    const end = await userLedger.ledgerEnd();
    const user = userLedger.getPartyId();
    const activeContractsByTemplate = (await userLedger.activeContracts({
        offset: end.offset,
        templateIds: [templateId],
        filterByParty: true,
        parties: [user],
    })) as ActiveContractResponse[];

    const contract = activeContractsByTemplate.find(
        (c) =>
            c.contractEntry.JsActiveContract?.createdEvent.contractId ===
            contractId
    );
    if (!contract) {
        throw new Error("Contract not found");
    }
    const { createdEvent, synchronizerId } =
        contract.contractEntry.JsActiveContract!;

    return {
        contractId,
        createdEventBlob: createdEvent.createdEventBlob,
        templateId,
        synchronizerId,
    };
}
