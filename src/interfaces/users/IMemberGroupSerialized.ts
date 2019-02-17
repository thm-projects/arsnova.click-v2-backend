import { IMemberGroupBase } from './IMemberGroupBase';

export interface IMemberGroupSerialized extends IMemberGroupBase {
  members?: Array<string>;
}
