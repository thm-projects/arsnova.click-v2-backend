import { QuestionType } from '../../enums/QuestionType';
import { IAnswer } from '../answeroptions/IAnswerEntity';

export interface IQuestionBase {
  readonly TYPE: QuestionType;
  displayAnswerText: boolean;
  timer: number;
  questionText: string;
}

export interface IQuestion extends IQuestionBase {
  answerOptionList: Array<IAnswer>;
}
