import { getModelForClass, prop, Severity } from '@typegoose/typegoose';
import { IsEnum, IsString } from 'class-validator';
import DbDAO from '../db/DbDAO';
import { DbCollection } from '../enums/DbOperation';
import { HistoryModelType } from '../enums/HistoryModelType';

export class HistoryModelItem {
  @prop({
    enum: HistoryModelType,
  }) //
  @IsEnum(HistoryModelType) //
  public type: HistoryModelType;

  @prop({ type: String }) //
  @IsString() //
  public name: string;

  @prop({ type: String, required: false }) //
  @IsString() //
  public ref: string;
}

export const HistoryModel = getModelForClass(HistoryModelItem, {
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
