import { arrayProp, getModelForClass, index, prop } from '@typegoose/typegoose';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IUserSerialized } from '../../interfaces/users/IUserSerialized';
import LoggerService from '../../services/LoggerService';

@index({ name: 1 }, { unique: true })
export class UserModelItem implements IUserSerialized {
  @prop({ required: true }) public name: string;
  @prop({ required: false }) public passwordHash: string;
  @prop({ required: false }) public tokenHash: string;
  @arrayProp({
    required: true,
    items: String,
  }) public userAuthorizations: Array<string>;
  @prop({ required: true }) public privateKey: string;
  @prop() public gitlabToken?: string;
  @prop() public token?: string;
}

export const UserModel = getModelForClass(UserModelItem, {
  schemaOptions: {
    collection: DbCollection.Users,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
});

UserModel.collection.dropIndexes().then(() => UserModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for UserModel created with error', err);
}));
