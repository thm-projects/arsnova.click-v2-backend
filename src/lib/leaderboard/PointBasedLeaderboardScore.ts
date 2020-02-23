import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';

export class PointBasedLeaderboardScore extends AbstractLeaderboardScore {

  constructor() {
    super();

    this.algorithm = this.algorithms.find(val => val.algorithm === LeaderboardConfiguration.TimeBased);
  }

  public getScoreForCorrect(responseTime: number, quizTimer: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForCorrect + (
      quizTimer * (
        (
        responseTime / 1000
        ) / 100
      )
    ));
    return result < 0 ? 0 : result;
  }

  public getScoreForPartiallyCorrect(responseTime: number, quizTimer: number): number {
    const result = Math.round(this.algorithm.parameters.bonusForPartiallyCorrect + (
      quizTimer * (
        (
        responseTime / 1000
        ) / 100
      )
    ));
    return result < 0 ? 0 : result;
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

  public getScoreForWrongAnswer(responseTime: number, quizTimer: number): number {
    if (this.algorithm.parameters.bonusForWrong === 0) {
      return 0;
    }

    const result = Math.round(this.algorithm.parameters.bonusForWrong + (
      quizTimer * (
        (
        responseTime / 1000
        ) / 100
      )
    ));
    return result < 0 ? 0 : result;
  }
}
