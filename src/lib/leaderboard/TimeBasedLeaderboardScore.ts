import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';

export class TimeBasedLeaderboardScore extends AbstractLeaderboardScore {

  constructor() {
    super();

    this.algorithm = this.algorithms.find(val => val.algorithm === LeaderboardConfiguration.TimeBased);
  }

  public getScoreForCorrect(responseTime: number): number {
    return Math.round(this.algorithm.parameters.bonusForCorrect / (responseTime / 1000) * 100);
  }

  public getScoreForPartiallyCorrect(responseTime: number): number {
    return 0;
  }

  public getScoreForGroup({ memberGroupResults, correctResponses, partiallyCorrectResponses, activeQuiz }): object {
    Object.values(memberGroupResults).forEach((memberGroup: any) => {
      const maxMembersPerGroup = activeQuiz.sessionConfig.nicks.maxMembersPerGroup;
      // (10 / 1) * (1 / 1) * (1.815 / 1) * 100 = 1815
      memberGroup.score = Math.round(
        (maxMembersPerGroup / memberGroup.memberAmount) * (memberGroup.correctQuestions.length / activeQuiz.questionList.length)
        * (memberGroup.responseTime / memberGroup.memberAmount) * 100);
    });

    return memberGroupResults;
  }
}
