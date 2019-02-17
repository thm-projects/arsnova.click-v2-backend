import { ObjectId } from 'bson';
import { IMemberGroupBase } from './IMemberGroupBase';
import { IMemberGroupSerialized } from './IMemberGroupSerialized';

export interface IMemberGroupEntity extends IMemberGroupBase {
  id?: ObjectId;
  members: Array<string>;

  serialize(): IMemberGroupSerialized;
}

