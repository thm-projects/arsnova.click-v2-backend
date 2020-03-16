import { getModelForClass, prop, Severity } from '@typegoose/typegoose';
import { IsBoolean, IsEmail, IsObject } from 'class-validator';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IQuestion } from '../../interfaces/questions/IQuestion';

export class QuizPoolModelItem {
  @prop({ validate: (value: IQuestion) => Array.isArray(value.tags) && value.tags.length > 0 }) //
  @IsObject() //
  public question: IQuestion;

  @prop({ default: false }) //
  @IsBoolean() //
  public approved: boolean;

  @prop({ required: false }) //
  @IsEmail({
    require_tld: true,
    allow_display_name: true,
    allow_utf8_local_part: true,
  }) //
  public notificationMail: string;
}

export const QuizPoolModel = getModelForClass(QuizPoolModelItem, {
  schemaOptions: {
    collection: DbCollection.QuizPool,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
  options: {
    runSyncIndexes: true,
    allowMixed: Severity.ALLOW,
  },
});
