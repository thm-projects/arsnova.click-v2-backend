import { IQuestionChoice } from './IQuestionChoice';

export interface IQuestionSurvey extends IQuestionChoice {
  multipleSelectionEnabled: boolean;
}
