import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';

export interface IAdminQuiz {
  expiry?: Date;
  id: string;
  name: string;
  state: QuizState;
  visibility: QuizVisibility;
  questionAmount: number;
  answerAmount: number;
}
