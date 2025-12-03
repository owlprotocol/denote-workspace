export type ContractsEqual<ContractParams = Record<string, unknown>> = (
    a: ContractParams,
    b: ContractParams
) => boolean;
