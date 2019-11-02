import { arrayProp, getModelForClass, index, prop } from '@typegoose/typegoose';
import DbDAO from '../../db/DbDAO';
import UserDAO from '../../db/UserDAO';
import { DbCollection, DbEvent, DbWatchStreamOperation } from '../../enums/DbOperation';
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

UserModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for UserModel created with error', err);
});

const eventCallback = data => {

  switch (data.operationType) {
    case DbWatchStreamOperation.Insert:
      LoggerService.info(`Inserting new UserModel: ${JSON.stringify(data.fullDocument.name)}`);
      UserDAO.addUser(data.fullDocument);
      break;
    case DbWatchStreamOperation.Update:
      LoggerService.info(`Updating existing UserModel: ${data.documentKey._id}, ${JSON.stringify(data.updateDescription.updatedFields)}`);
      UserDAO.updateUser(data.documentKey._id, data.updateDescription.updatedFields);
      break;
    case DbWatchStreamOperation.Invalidate:
      LoggerService.info(`Invalidating UserModel storage`);
      UserDAO.clearStorage();
      attachEventCallback();
      break;
    case DbWatchStreamOperation.Delete:
      LoggerService.info(`Deleting user: ${data.documentKey._id}`);
      UserDAO.removeUser(data.documentKey._id);
      break;
    default:
      LoggerService.error(`Unknown db operationType '${data.operationType}' in change listener of UserModel`);
  }
};

function attachEventCallback(): void {
  UserModel.watch().on(DbEvent.Change, eventCallback);
}

attachEventCallback();
