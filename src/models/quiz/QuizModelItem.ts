import { arrayProp, getModelForClass, index, prop } from '@typegoose/typegoose';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import LoggerService from '../../services/LoggerService';
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
  @prop({ _id: false }) public sessionConfig: SessionConfigurationModelItem;
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
});

QuizModel.collection.dropIndexes().then(() => QuizModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for QuizModel created with error', err);
}));
