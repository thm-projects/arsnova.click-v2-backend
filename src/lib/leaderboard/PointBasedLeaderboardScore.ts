import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';

export class PointBasedLeaderboardScore extends AbstractLeaderboardScore {

  constructor() {
    super();

    this.algorithm = this.algorithms.find(val => val.algorithm === LeaderboardConfiguration.PointBased);
  }

  public getScoreForCorrect(responseTime: number): number {
    return this.algorithm.parameter.bonusForTime.parameter.find(val => val.value <= (responseTime / 1000)).bonus;
  }

  public getScoreForPartiallyCorrect(responseTime: number): number {
    return 0;
  }

  public getScoreForGroup({ memberGroupResults, correctResponses, partiallyCorrectResponses, activeQuiz }): object {
    Object.values(memberGroupResults).forEach((memberGroup: any) => {
      memberGroup.score += Object.values(correctResponses).map(val => val.score);
    });

    return memberGroupResults;
  }
}
