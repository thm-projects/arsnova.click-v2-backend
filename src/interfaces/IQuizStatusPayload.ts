import { QuizState } from '../enums/QuizState';
import { IQuizSerialized } from './quizzes/IQuizEntity';

export interface IQuizStatusPayload {
  startTimestamp?: number;
  quiz?: IQuizSerialized;
  name?: string;
  state?: QuizState;
  available?: boolean;
  readingConfirmationRequested?: boolean;
  provideNickSelection?: boolean;
  authorizeViaCas?: boolean;
  maxMembersPerGroup?: number;
  autoJoinToGroup?: boolean;
  memberGroups?: Array<string>;
}
