import { FilterQuery } from 'mongodb';
import { AbstractEntity } from '../../entities/AbstractEntity';

export interface IDbObject {
  query?: FilterQuery<any>;
  value?: AbstractEntity | Array<AbstractEntity>;
}
