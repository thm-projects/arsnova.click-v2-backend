import { getModelForClass, prop, Severity } from '@typegoose/typegoose';
import { IsArray, IsEnum, IsString } from 'class-validator';
import DbDAO from '../db/DbDAO';
import { DbCollection } from '../enums/DbOperation';
import { MessageOfTheDayModelType } from '../enums/MessageOfTheDayModelType';

export class MessageOfTheDayModelItem {
  @prop({
    enum: MessageOfTheDayModelType,
  }) //
  @IsEnum(MessageOfTheDayModelType) //
  public type: MessageOfTheDayModelType;

  @prop({ type: String }) //
  @IsString() //
  public header: string;

  @prop({ type: String}) //
  @IsString() //
  public content: string;

  @prop({ type: Date}) //
  @IsArray() //
  public expiryDate: Date;
}

export const MessageOfTheDayModel = getModelForClass(MessageOfTheDayModelItem, {
  schemaOptions: {
    collection: DbCollection.History,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
  options: {
    runSyncIndexes: true,
    allowMixed: Severity.ALLOW,
  },
});