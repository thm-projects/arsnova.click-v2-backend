import { arrayProp, getModelForClass, index, prop, Severity } from '@typegoose/typegoose';
import { IsArray, IsString } from 'class-validator';
import { PushSubscription } from 'web-push';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IUserSerialized } from '../../interfaces/users/IUserSerialized';

@index({ name: 1 }, { unique: true })
export class UserModelItem implements IUserSerialized {
  @prop({ required: true }) @IsString() public name: string;
  @prop({ required: false }) @IsString() public passwordHash: string;
  @prop({ required: false }) @IsString() public tokenHash: string;
  @arrayProp({
    required: true,
    items: String,
  }) @IsArray() public userAuthorizations: Array<string>;
  @arrayProp({
    required: true,
    items: Object,
  }) @IsArray() public subscriptions: Array<PushSubscription>;
  @prop({ required: true }) @IsString() public privateKey: string;
  @prop() @IsString() public gitlabToken?: string;
  @prop() @IsString() public token?: string;
}

export const UserModel = getModelForClass(UserModelItem, {
  schemaOptions: {
    collection: DbCollection.Users,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
  options: {
    runSyncIndexes: true,
    allowMixed: Severity.ALLOW,
  },
});
