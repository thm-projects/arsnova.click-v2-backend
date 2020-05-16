import * as path from 'path';
import { ILeaderboardConfigurationAlgorithm } from '../../interfaces/leaderboard/ILeaderboardConfigurationAlgorithm';
import { settings } from '../../statistics';

export abstract class AbstractLeaderboardScore {
  protected algorithm: ILeaderboardConfigurationAlgorithm;
  protected readonly algorithms: Array<ILeaderboardConfigurationAlgorithm> = require(
    path.join(settings.pathToAssets, 'leaderboard-config.json'));

  public abstract getScoreForCorrect(responseTime: number, quizTimer: number): number;

  public abstract getScoreForPartiallyCorrect(responseTime: number, quizTimer: number): number;

  public abstract getScoreForGroup({ memberGroupResults, correctResponses, activeQuiz }): object;

  public abstract getScoreForWrongAnswer(responseTime: number, quizTimer: number): number;

}
