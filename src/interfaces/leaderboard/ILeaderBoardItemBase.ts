export interface ILeaderBoardItemBase {
  name: string;
  responseTime: number;
  correctQuestions: Array<number>;
  confidenceValue: number;
  score: number;
}
