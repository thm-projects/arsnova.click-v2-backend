import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';

export class TimeBasedLeaderboardScore extends AbstractLeaderboardScore {

  constructor() {
    super();

    this.algorithm = this.algorithms.find(val => val.algorithm === LeaderboardConfiguration.TimeBased);
  }

  public getScoreForCorrect(responseTime: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForCorrect - (
      responseTime / 1000
    ));
    return result < 0 ? 1 : result;
  }

  public getScoreForPartiallyCorrect(responseTime: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForPartiallyCorrect - (
      responseTime / 1000
    ));
    return result < 0 ? 1 : result;
  }

  public getScoreForGroup({ memberGroupResults, correctResponses, activeQuiz }): object {
    Object.values(memberGroupResults).forEach((memberGroup: any) => {
      memberGroup.score = Math.round((
                                       memberGroup.correctQuestions.length / memberGroup.memberAmount / activeQuiz.questionList.length
                                     ) * (
                                       memberGroup.responseTime / memberGroup.memberAmount
                                     ));
    });

    return memberGroupResults;
  }

  public getScoreForWrongAnswer(responseTime: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForWrong - (
      responseTime / 1000
    ));
    return result < 0 ? 1 : result;
  }
}
