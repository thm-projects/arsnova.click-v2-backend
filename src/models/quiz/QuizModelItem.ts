import { arrayProp, index, prop, Typegoose } from 'typegoose';
import DbDAO from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { AbstractQuestionEntity } from '../../entities/question/AbstractQuestionEntity';
import { DbCollection, DbEvent, DbWatchStreamOperation } from '../../enums/DbOperation';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { ISessionConfigurationSerialized } from '../../interfaces/session_configuration/ISessionConfigurationSerialized';
import { IMemberGroupSerialized } from '../../interfaces/users/IMemberGroupSerialized';
import LoggerService from '../../services/LoggerService';

@index({ name: 1 }, { unique: true })
export class QuizModelItem extends Typegoose implements IQuizSerialized {
  @prop({ required: false }) public expiry?: Date;
  @prop({
    required: false,
    enum: QuizVisibility,
    default: QuizVisibility.Account,
  }) public visibility?: QuizVisibility;
  @prop() public name: string;
  @arrayProp({ items: Object }) public questionList: Array<AbstractQuestionEntity>;
  @prop({
    default: QuizState.Inactive,
    enum: QuizState,
  }) public state: QuizState;
  @prop() public sessionConfig: ISessionConfigurationSerialized;
  @prop() public currentStartTimestamp: number;
  @prop() public memberGroups: Array<IMemberGroupSerialized>;
  @prop() public currentQuestionIndex: number;
  @prop() public adminToken: string;
  @prop() public privateKey: string;
  @prop() public description?: string;
  @prop() public readingConfirmationRequested: boolean;
}

export const QuizModel = new QuizModelItem().getModelForClass(QuizModelItem, {
  schemaOptions: {
    collection: DbCollection.Quizzes,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
});

QuizModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for QuizModel created with error', err);
});

const eventCallback = data => {

  switch (data.operationType) {
    case DbWatchStreamOperation.Insert:
      LoggerService.info(`Inserting new QuizModel: ${JSON.stringify(data.fullDocument.name)}`);
      QuizDAO.addQuiz(data.fullDocument);
      break;
    case DbWatchStreamOperation.Update:
      LoggerService.info(`Updating existing QuizModel: ${data.documentKey._id}, ${JSON.stringify(data.updateDescription.updatedFields)}`);
      QuizDAO.updateQuiz(data.documentKey._id, data.updateDescription.updatedFields);
      break;
    case DbWatchStreamOperation.Invalidate:
      LoggerService.info(`Invalidating QuizModel storage`);
      QuizDAO.clearStorage();
      attachEventCallback();
      break;
    case DbWatchStreamOperation.Delete:
      LoggerService.info(`Deleting quiz: ${data.documentKey._id}`);
      QuizDAO.removeQuiz(data.documentKey._id);
      break;
    default:
      LoggerService.error(`Unknown db operationType '${data.operationType}' in change listener of QuizModel`);
  }
};

function attachEventCallback(): void {
  QuizModel.watch().on(DbEvent.Change, eventCallback);
}

attachEventCallback();
