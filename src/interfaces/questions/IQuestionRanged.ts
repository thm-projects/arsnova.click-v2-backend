import { IQuestion } from './IQuestion';

export interface IQuestionRanged extends IQuestion {
  rangeMax: number;
  rangeMin: number;
  correctValue: number;
}
