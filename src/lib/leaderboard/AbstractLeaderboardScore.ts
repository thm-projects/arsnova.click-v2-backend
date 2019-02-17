import * as path from 'path';
import { ILeaderboardConfigurationAlgorithm } from '../../interfaces/leaderboard/ILeaderboardConfigurationAlgorithm';
import { staticStatistics } from '../../statistics';

export abstract class AbstractLeaderboardScore {
  protected algorithm: ILeaderboardConfigurationAlgorithm;
  protected readonly algorithms: Array<ILeaderboardConfigurationAlgorithm> = require(
    path.join(staticStatistics.pathToAssets, 'leaderboard-config.json'));

  public abstract getScoreForCorrect(responseTime: number): number;

  public abstract getScoreForPartiallyCorrect(responseTime: number): number;

  public abstract getScoreForGroup({ memberGroupResults, correctResponses, activeQuiz }): object;

  public abstract getScoreForWrongAnswer(responseTime: number): number;

}
