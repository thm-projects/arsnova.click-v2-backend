import { IMemberBase } from './IMemberBase';

export interface IMemberSerialized extends IMemberBase {
  _id?: string;
  id?: string;
}
