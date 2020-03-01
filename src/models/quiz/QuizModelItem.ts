import { arrayProp, getModelForClass, index, prop, Severity } from '@typegoose/typegoose';
import { Document } from 'mongoose';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { SessionConfigurationModelItem } from '../session-config/SessionConfigurationModelItem';

@index({ name: 1 }, {
  unique: true,
  collation: {
    locale: 'en',
    strength: 1,
  },
})
export class QuizModelItem {
  @prop({ required: false }) public expiry?: Date;
  @prop({
    required: false,
    enum: QuizVisibility,
    default: QuizVisibility.Account,
  }) public visibility?: QuizVisibility;
  @prop({
    minlength: 2,
    trim: true,
  }) public name: string;
  @arrayProp({ items: Object }) public questionList: Array<IQuestion>;
  @prop({
    default: QuizState.Inactive,
    enum: QuizState,
  }) public state: QuizState;
  @prop({ _id: false }) public sessionConfig: Document & SessionConfigurationModelItem;
  @prop() public currentStartTimestamp: number;
  @prop() public currentQuestionIndex: number;
  @prop() public privateKey: string;
  @prop() public description?: string;
  @prop() public readingConfirmationRequested: boolean;
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
