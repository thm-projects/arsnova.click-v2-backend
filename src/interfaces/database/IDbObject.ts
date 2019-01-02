import { FilterQuery } from 'mongodb';
import { IEntity } from '../entities/IEntity';

export interface IDbObject extends Object {
  query?: FilterQuery<any>;
  value?: IEntity | Array<IEntity>;
}
