import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuestion, IQuestionBase } from '../questions/IQuestion';
import { ISessionConfiguration } from '../session_configuration/ISessionConfiguration';

export interface IQuiz extends IQuizBase {
  questionList: Array<IQuestion>;
}

export interface IQuizBase {
  questionList: Array<IQuestionBase>;
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
