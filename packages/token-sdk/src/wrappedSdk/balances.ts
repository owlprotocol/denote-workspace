import { PrettyContract, Holding } from "@canton-network/core-ledger-client";
import { WalletSDK } from "@canton-network/wallet-sdk";
import { ContractId, Party } from "../types/daml.js";
import { InstrumentId } from "../types/InstrumentId.js";
export { getContractDisclosure } from "./contractDisclosure.js";

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

export interface GetAllBalancesByInstrumentIdParams {
    instrumentId: { admin: Party; id: string };
}

export interface PartyBalance {
    party: Party;
    total: number;
    utxos: { amount: number; contractId: ContractId }[];
}

export async function getAllBalancesByInstrumentId(
    sdk: WalletSDK,
    { instrumentId }: GetAllBalancesByInstrumentIdParams
): Promise<PartyBalance[]> {
    if (!sdk.tokenStandard) {
        throw new Error("Token standard SDK not initialized");
    }

    const utxosUnformatted = await sdk.tokenStandard.listHoldingUtxos(false);
    const targetInstrumentIdStr = instrumentIdToString(instrumentId);

    const balancesByParty: Record<Party, TokenBalance> = {};

    utxosUnformatted.forEach((utxo) => {
        const utxoInstrumentIdStr = instrumentIdToString(
            utxo.interfaceViewValue.instrumentId
        );
        if (utxoInstrumentIdStr === targetInstrumentIdStr) {
            const owner = utxo.interfaceViewValue.owner;
            if (!balancesByParty[owner]) {
                balancesByParty[owner] = { total: 0, utxos: [] };
            }

            const amount = Number(utxo.interfaceViewValue.amount);
            balancesByParty[owner].total += amount;
            balancesByParty[owner].utxos.push({
                amount,
                contractId: utxo.contractId,
            });
        }
    });

    return Object.entries(balancesByParty).map(([party, balance]) => ({
        party,
        ...balance,
    }));
}
