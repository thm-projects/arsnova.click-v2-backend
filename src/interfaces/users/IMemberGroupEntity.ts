import { ObjectId } from 'bson';
import { IMemberEntity } from '../entities/Member/IMemberEntity';
import { IMemberGroupBase } from './IMemberGroupBase';
import { IMemberGroupSerialized } from './IMemberGroupSerialized';

export interface IMemberGroupEntity extends IMemberGroupBase {
  id?: ObjectId;
  members: Array<IMemberEntity>;

  serialize(): IMemberGroupSerialized;
}

