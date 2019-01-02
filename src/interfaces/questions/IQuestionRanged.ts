import { IQuestionSerialized } from './IQuestion';

export interface IQuestionRangedBase extends IQuestionSerialized {
  rangeMax: number;
  rangeMin: number;
  correctValue: number;
}
