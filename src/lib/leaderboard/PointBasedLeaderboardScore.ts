import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';

export class PointBasedLeaderboardScore extends AbstractLeaderboardScore {

  constructor() {
    super();

    this.algorithm = this.algorithms.find(val => val.algorithm === LeaderboardConfiguration.PointBased);
  }

  public getScoreForCorrect(responseTime: number, quizTimer: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForCorrect + (
      quizTimer - (
        responseTime / 1000
      )
    ));
    return result < 0 ? 0 : result;
  }

  public getScoreForPartiallyCorrect(responseTime: number, quizTimer: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForPartiallyCorrect + (
      quizTimer - (
        responseTime / 1000
      )
    ));
    return result < 0 ? 0 : result;
  }

  public getScoreForGroup({ memberGroupResults, correctResponses, activeQuiz }): object {
    Object.values(memberGroupResults).forEach((memberGroup: any) => {
      memberGroup.score = Math.round(memberGroup.score / memberGroup.memberAmount);
    });

    return memberGroupResults;
  }

  public getScoreForWrongAnswer(responseTime: number, quizTimer: number): number {
    return Math.round(this.algorithm.parameters.bonusForWrong || 0);
  }
}
