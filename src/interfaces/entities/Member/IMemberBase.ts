import { IQuizResponse } from '../../quizzes/IQuizResponse';

export interface IMemberBase {
  name: string;
  groupName: string;
  token: string;
  currentQuizName: string;
  colorCode?: string;
  ticket?: string;
  responses?: Array<IQuizResponse>;
  bonusToken?: string;
  isActive?: boolean;
}

