import { QuestionType } from '../../enums/QuestionType';
import { IAnswer } from '../answeroptions/IAnswerEntity';
import { IFreetextAnswer } from '../answeroptions/IFreetextAnswer';

export interface IQuestionBase {
  readonly TYPE: QuestionType;
  displayAnswerText: boolean;
  timer: number;
  questionText: string;
  answerOptionList: Array<IAnswer | IFreetextAnswer>;
}

export interface IQuestion extends IQuestionBase {
  answerOptionList: Array<IAnswer>;
}
