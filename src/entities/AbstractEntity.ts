import { ObjectId } from 'bson';

export abstract class AbstractEntity {
  public _id: ObjectId;

  get id(): ObjectId {
    return this._id;
  }

  set id(value: ObjectId) {
    this._id = value;
  }
}
