import { getModelForClass, index, modelOptions, prop, Severity } from '@typegoose/typegoose';
import { IsArray, IsString } from 'class-validator';
import { PushSubscription } from 'web-push';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IUserSerialized } from '../../interfaces/users/IUserSerialized';

@index({ name: 1 }, { unique: true }) //
@modelOptions({ options: { allowMixed: Severity.ALLOW } }) //
export class UserModelItem implements IUserSerialized {
  @prop({ required: true }) @IsString() public name: string;
  @prop({ required: false }) @IsString() public passwordHash: string;
  @prop({ required: false }) @IsString() public tokenHash: string;
  @prop({
    required: true,
    type: String,
  }) @IsArray() public userAuthorizations: Array<string>;
  @prop({
    required: true,
    type: Object,
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
