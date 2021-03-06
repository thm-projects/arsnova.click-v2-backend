import { QuizState } from '../enums/QuizState';
import { IQuiz } from './quizzes/IQuizEntity';
import { IMemberGroupBase } from './users/IMemberGroupBase';

export interface IQuizStatusPayload {
  startTimestamp?: number;
  quiz?: IQuiz;
  name?: string;
  state?: QuizState;
  available?: boolean;
  readingConfirmationRequested?: boolean;
  provideNickSelection?: boolean;
  authorizeViaCas?: boolean;
  maxMembersPerGroup?: number;
  autoJoinToGroup?: boolean;
  memberGroups?: Array<IMemberGroupBase>;
}
