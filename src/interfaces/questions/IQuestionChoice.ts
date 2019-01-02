import { IQuestionSerialized } from './IQuestion';

export interface IQuestionChoiceBase extends IQuestionSerialized {
  displayAnswerText: boolean;
  showOneAnswerPerRow: boolean;
}

export interface IQuestionChoice extends IQuestionChoiceBase {
  displayAnswerText: boolean;
  showOneAnswerPerRow: boolean;

  addDefaultAnswerOption(index?: number): void;
}
