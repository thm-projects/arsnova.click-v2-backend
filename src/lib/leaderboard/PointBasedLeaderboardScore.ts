import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';

export class PointBasedLeaderboardScore extends AbstractLeaderboardScore {

  constructor() {
    super();

    this.algorithm = this.algorithms.find(val => val.algorithm === LeaderboardConfiguration.PointBased);
  }

  public getScoreForCorrect(responseTime: number): number {
    return this.algorithm.parameters.bonusForCorrect + this.algorithm.parameters.bonusForTime.parameter.find(
      val => val.value <= (responseTime / 1000)).bonus;
  }

  public getScoreForPartiallyCorrect(responseTime: number): number {
    return this.algorithm.parameters.bonusForPartiallyCorrect + this.algorithm.parameters.bonusForTime.parameter.find(
      val => val.value <= (responseTime / 1000)).bonus;
  }

  public getScoreForGroup({ memberGroupResults, correctResponses, activeQuiz }): object {
    Object.values(memberGroupResults).forEach((memberGroup: any) => {
      memberGroup.score += Object.values(correctResponses).map((val: any) => val.score);
    });

    return memberGroupResults;
  }

  public getScoreForWrongAnswer(responseTime: number): number {
    return this.algorithm.parameters.bonusForWrong + this.algorithm.parameters.bonusForTime.parameter.find(
      val => val.value <= (responseTime / 1000)).bonus;
  }
}
