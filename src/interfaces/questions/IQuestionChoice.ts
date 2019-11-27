import { IQuestion } from './IQuestion';

export interface IQuestionChoice extends IQuestion {
  displayAnswerText: boolean;
  showOneAnswerPerRow: boolean;
}
