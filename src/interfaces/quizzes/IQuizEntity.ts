import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuestion, IQuestionBase } from '../questions/IQuestion';
import { IQuestionFreetext } from '../questions/IQuestionFreetext';
import { IQuestionRanged } from '../questions/IQuestionRanged';
import { IQuestionSurvey } from '../questions/IQuestionSurvey';
import { ISessionConfiguration } from '../session_configuration/ISessionConfiguration';

export interface IQuiz extends IQuizBase {
  questionList: Array<Partial<IQuestion | IQuestionRanged | IQuestionFreetext | IQuestionSurvey>>;
}

export interface IQuizBase {
  questionList: Array<Partial<IQuestionBase>>;
  _id?: string;
  id?: string;
  sessionConfig: ISessionConfiguration;
  readingConfirmationRequested: boolean;
  name: string;
  currentQuestionIndex?: number;
  expiry?: Date;
  state?: QuizState;
  currentStartTimestamp?: number;
  privateKey: string;
  visibility?: QuizVisibility;
  description?: string;
}
