import { AnswerType } from '../../enums/AnswerType';

export interface IAnswer {
  readonly TYPE: AnswerType;
  isCorrect: boolean;
  answerText: string;
}
