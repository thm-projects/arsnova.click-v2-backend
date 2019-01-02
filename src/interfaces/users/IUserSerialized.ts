import { IUserBase } from './IUserBase';

export interface IUserSerialized extends IUserBase {
  _id?: string;
  id?: string;
  userAuthorizations: Array<string>;
}
