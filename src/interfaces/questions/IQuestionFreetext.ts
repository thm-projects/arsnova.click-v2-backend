import { IFreetextAnswer } from '../answeroptions/IFreetextAnswer';
import { IQuestionBase } from './IQuestion';

export interface IQuestionFreetext extends IQuestionBase {
  answerOptionList: Array<IFreetextAnswer>;
}
