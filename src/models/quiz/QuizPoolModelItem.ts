import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose';
import { IsBoolean, IsEmail, IsObject, IsString } from 'class-validator';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IQuestion } from '../../interfaces/questions/IQuestion';

@modelOptions({ options: { allowMixed: Severity.ALLOW } }) //
export class QuizPoolModelItem {
  @prop({ validate: (value: IQuestion) => Array.isArray(value.tags) && value.tags.length > 0 }) //
  @IsObject() //
  public question: IQuestion;

  @prop({ default: false }) //
  @IsBoolean() //
  public approved: boolean;

  @prop({ default: 'quiz-pool' }) //
  @IsString() //
  public origin: string;

  @prop({ unique: true }) //
  @IsString() //
  public hash: string;

  @prop({
    validate: function (value: object): boolean {
      return Object.keys(value).every(key => this.question[key] ?? false);
    },
  }) //
  @IsObject() //
  public contentHash: Partial<{ [key in keyof IQuestion]: string }>;

  @prop({ required: false }) //
  @IsEmail({
    require_tld: true,
    allow_display_name: true,
    allow_utf8_local_part: true,
  }) //
  public subscription?: PushSubscriptionJSON;
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
