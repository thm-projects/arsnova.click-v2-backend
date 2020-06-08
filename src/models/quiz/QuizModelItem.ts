import { getModelForClass, index, prop, Severity } from '@typegoose/typegoose';
import { IsArray, IsBoolean, IsDate, IsEnum, IsNumber, IsObject, IsString } from 'class-validator';
import { Document } from 'mongoose';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { SessionConfigurationModelItem } from '../session-config/SessionConfigurationModelItem';

@index({ name: 1 }, {
  unique: true,
  collation: {
    locale: 'en',
    strength: 1,
  },
})
export class QuizModelItem implements IQuiz {
  @prop({ required: false }) @IsDate() public expiry?: Date;
  @prop({
    required: false,
    enum: QuizVisibility,
    default: QuizVisibility.Account,
  }) @IsEnum(QuizVisibility) public visibility?: QuizVisibility;
  @prop({
    minlength: 2,
    trim: true,
  }) @IsString() public name: string;
  @prop({
    minlength: 2,
    trim: true,
    required: false,
  }) @IsString() public origin?: string;
  @prop({ type: Object }) @IsArray() public questionList: Array<IQuestion>;
  @prop({
    default: QuizState.Inactive,
    enum: QuizState,
  }) @IsEnum(QuizState) public state: QuizState;
  @prop({ _id: false }) @IsObject() public sessionConfig: Document & SessionConfigurationModelItem;
  @prop() @IsNumber() public currentStartTimestamp: number;
  @prop() @IsNumber() public currentQuestionIndex: number;
  @prop() @IsString() public privateKey: string;
  @prop() @IsString() public description?: string;
  @prop() @IsBoolean() public readingConfirmationRequested: boolean;
}

export const QuizModel = getModelForClass(QuizModelItem, {
  schemaOptions: {
    collection: DbCollection.Quizzes,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
  options: {
    runSyncIndexes: true,
    allowMixed: Severity.ALLOW,
  },
});
