import { IAnswerBase, IAnswerEntity } from '../answeroptions/IAnswerEntity';
import { IValidationStackTrace } from '../IValidationStackTrace';

export interface IQuestionBase {
  readonly TYPE: string;
  displayAnswerText: boolean;
  timer: number;
  questionText: string;
}

export interface IQuestionSerialized extends IQuestionBase {
  answerOptionList: Array<IAnswerBase>;
}

export interface IQuestion extends IQuestionBase {
  answerOptionList: Array<IAnswerEntity>;

  isValid(): boolean;

  equals(question: IQuestion): boolean;

  serialize(): any;

  getValidationStackTrace(): Array<IValidationStackTrace>;

  translationReferrer(): string;

  translationDescription(): string;
}
