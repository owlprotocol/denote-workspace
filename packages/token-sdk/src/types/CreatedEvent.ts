export interface CreatedEvent<ContractParams = Record<string, unknown>> {
    createArgument: ContractParams;
}
