import { IQuizResponse } from '../quizzes/IQuizResponse';

export interface ILeaderBoardItemBase {
  name: string;
  responseTime: number;
  correctQuestions: Array<number>;
  confidenceValue: number;
  score: number;
}

export interface ILeaderboardMemberGroupItem {
  confidence: number;
  names: Array<string>;
  responseTimes: number;
  responses: Array<IQuizResponse>;
  score: number;
  _id: string;
}
