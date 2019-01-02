import { ObjectId } from 'bson';
import { UserRole } from '../../enums/UserRole';
import { IUserBase } from './IUserBase';
import { IUserSerialized } from './IUserSerialized';

export interface IUserEntity extends IUserBase {
  id: ObjectId;
  userAuthorizations: Array<UserRole>;

  validateToken(token: string): boolean;

  serialize(): IUserSerialized;
}
