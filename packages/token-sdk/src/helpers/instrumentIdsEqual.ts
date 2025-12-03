import { InstrumentId } from "../types/InstrumentId.js";

export const instrumentIdsEqual = (
    a: InstrumentId,
    b: InstrumentId
): boolean => {
    return a.admin === b.admin && a.id === b.id;
};
