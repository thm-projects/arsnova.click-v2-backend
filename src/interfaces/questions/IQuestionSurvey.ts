import { IQuestionChoiceBase } from './IQuestionChoice';

export interface IQuestionSurveyBase extends IQuestionChoiceBase {
  multipleSelectionEnabled: boolean;
}
