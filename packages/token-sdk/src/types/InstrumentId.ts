import { Party } from "./daml.js";

export interface InstrumentId {
    admin: Party;
    id: string;
}
