import { Api } from "../database/Context.js";

export type DataEventType = "INSERT" | "UPDATE" | "DELETE";

export interface DataEvent {
  type: DataEventType;
  api: Api;
  id: string;
  entity?: any;
  previousEntity?: any;
}
