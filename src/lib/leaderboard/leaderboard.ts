import MemberDAO from '../../db/MemberDAO';
import { FreeTextAnswerEntity } from '../../entities/answer/FreetextAnwerEntity';
import { AbstractChoiceQuestionEntity } from '../../entities/question/AbstractChoiceQuestionEntity';
import { AbstractQuestionEntity } from '../../entities/question/AbstractQuestionEntity';
import { FreeTextQuestionEntity } from '../../entities/question/FreeTextQuestionEntity';
import { RangedQuestionEntity } from '../../entities/question/RangedQuestionEntity';
import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { QuestionType } from '../../enums/QuestionType';
import { ILeaderBoardItemBase } from '../../interfaces/leaderboard/ILeaderBoardItemBase';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';
import { PointBasedLeaderboardScore } from './PointBasedLeaderboardScore';
import { TimeBasedLeaderboardScore } from './TimeBasedLeaderboardScore';

export class Leaderboard {
  private readonly _timebasedLeaderboard: AbstractLeaderboardScore = new TimeBasedLeaderboardScore();
  private readonly _pointbasedLeaderboard: AbstractLeaderboardScore = new PointBasedLeaderboardScore();
  private readonly _defaultLeaderboard: AbstractLeaderboardScore;

  constructor() {
    switch (staticStatistics.leaderboardAlgorithm) {
      case LeaderboardConfiguration.TimeBased:
        this._defaultLeaderboard = this._timebasedLeaderboard;
        break;
      case LeaderboardConfiguration.PointBased:
        this._defaultLeaderboard = this._pointbasedLeaderboard;
        break;
      default:
    }
  }

  public isCorrectResponse(response: IQuizResponse, question: AbstractQuestionEntity): number {
    switch (question.TYPE) {
      case QuestionType.SingleChoiceQuestion:
      case QuestionType.YesNoSingleChoiceQuestion:
      case QuestionType.TrueFalseSingleChoiceQuestion:
        return this.isCorrectSingleChoiceQuestion(<number>response.value[0], <AbstractChoiceQuestionEntity>question) ? 1 : -1;
      case QuestionType.MultipleChoiceQuestion:
        return this.isCorrectMultipleChoiceQuestion(<Array<number>>response.value, <AbstractChoiceQuestionEntity>question);
      case QuestionType.ABCDSingleChoiceQuestion:
      case QuestionType.SurveyQuestion:
        return 1;
      case QuestionType.RangedQuestion:
        return this.isCorrectRangedQuestion(<number>response.value, <RangedQuestionEntity>question);
      case QuestionType.FreeTextQuestion:
        return this.isCorrectFreeTextQuestion(<string>response.value, <FreeTextQuestionEntity>question) ? 1 : -1;
      default:
        throw new Error(`Unsupported question type while checking correct response. Received type ${question.TYPE}`);
    }
  }

  public objectToArray(obj: Object): Array<ILeaderBoardItemBase> {
    const keyList: Array<string> = Object.keys(obj);
    if (!keyList.length) {
      return [];
    }
    return keyList.map((value, index) => {
      return {
        name: keyList[index],
        responseTime: obj[value].responseTime || -1,
        correctQuestions: obj[value].correctQuestions,
        confidenceValue: obj[value].confidenceValue / obj[value].correctQuestions.length,
        score: obj[value].score,
      };
    }).filter(value => value.score > 0);
  }

  public buildLeaderboard(activeQuiz: IQuizEntity, questionIndex?: number): any {
    let scoringLeaderboard: AbstractLeaderboardScore;

    if (activeQuiz.sessionConfig.leaderboardAlgorithm === LeaderboardConfiguration.TimeBased) {
      scoringLeaderboard = this._timebasedLeaderboard;
    } else if (activeQuiz.sessionConfig.leaderboardAlgorithm === LeaderboardConfiguration.PointBased) {
      scoringLeaderboard = this._pointbasedLeaderboard;
    } else {
      scoringLeaderboard = this._defaultLeaderboard;
    }

    const questionAmount: number = activeQuiz.questionList.length;
    const endIndex: number = isNaN(questionIndex) || questionIndex < 0 || questionIndex > questionAmount ? questionAmount : questionIndex + 1;
    const responses: any = {};

    const orderByGroups = activeQuiz.sessionConfig.nicks.memberGroups.length > 1;
    const memberGroupResults = {};
    const members = MemberDAO.getMembersOfQuiz(activeQuiz.name);

    activeQuiz.sessionConfig.nicks.memberGroups.forEach((memberGroup) => {
      const membersOfGroup = members.filter(member => member.groupName === memberGroup);

      memberGroupResults[memberGroup] = {
        correctQuestions: [],
        responseTime: 0,
        score: 0,
        memberAmount: membersOfGroup.length,
      };

      membersOfGroup.forEach(attendee => {
        if (!attendee) {
          LoggerService.error(`Cannot find member ${attendee} in DAO which should be in quiz ${activeQuiz.name}`);
          return;
        }

        for (let i = 0; i < endIndex; i++) {
          const question: AbstractQuestionEntity = activeQuiz.questionList[i];
          if ([QuestionType.SurveyQuestion, QuestionType.ABCDSingleChoiceQuestion].includes(question.TYPE)) {
            continue;
          }
          if (!responses[attendee.name]) {
            responses[attendee.name] = {
              responseTime: 0,
              correctQuestions: [],
              confidenceValue: 0,
              score: 0,
            };
          }
          responses[attendee.name].confidenceValue += <number>attendee.responses[i].confidence;
          responses[attendee.name].responseTime += <number>attendee.responses[i].responseTime;

          memberGroupResults[memberGroup].responseTime += <number>attendee.responses[i].responseTime;

          const isCorrect = this.isCorrectResponse(attendee.responses[i], question);
          if (isCorrect === 1) {
            responses[attendee.name].correctQuestions.push(i);
            responses[attendee.name].score += scoringLeaderboard.getScoreForCorrect(attendee.responses[i].responseTime);

            memberGroupResults[memberGroup].correctQuestions.push(i);

          } else if (isCorrect === 0) {
            responses[attendee.name].correctQuestions.push(i);
            responses[attendee.name].score += scoringLeaderboard.getScoreForPartiallyCorrect(attendee.responses[i].responseTime);

            memberGroupResults[memberGroup].correctQuestions.push(i);

          } else {
            responses[attendee.name].score += scoringLeaderboard.getScoreForWrongAnswer(attendee.responses[i].responseTime);
          }
        }
      });
    });

    if (orderByGroups) {
      scoringLeaderboard.getScoreForGroup({
        memberGroupResults,
        correctResponses: responses,
        activeQuiz,
      });
    }

    return {
      correctResponses: responses,
      memberGroupResults,
    };
  }

  public sortBy(correctResponses: Array<ILeaderBoardItemBase>, parameter: string): Array<ILeaderBoardItemBase>;
  public sortBy(correctResponses: object, parameter: string): Array<ILeaderBoardItemBase>;
  public sortBy(correctResponses: object | Array<ILeaderBoardItemBase>, parameter: string): Array<ILeaderBoardItemBase> {
    const comparator = (a, b) => {
      return a[parameter] > b[parameter] ? -1 : a[parameter] === b[parameter] ? 0 : 1;
    };

    if (Array.isArray(correctResponses)) {
      return correctResponses.sort(comparator);
    } else {
      return this.objectToArray(correctResponses).sort(comparator);
    }
  }

  private isCorrectSingleChoiceQuestion(response: number, question: AbstractChoiceQuestionEntity): boolean {
    if (typeof response === 'undefined' || typeof response !== 'number' || !question.answerOptionList[response]) {
      return false;
    }

    return question.answerOptionList[response] && question.answerOptionList[response].isCorrect;
  }

  private isCorrectMultipleChoiceQuestion(response: Array<number>, question: AbstractChoiceQuestionEntity): number {
    if (!Array.isArray(response)) {
      return -1;
    }

    let hasCorrectAnswers = 0;
    let hasWrongAnswers = 0;
    question.answerOptionList.forEach((answeroption, answerIndex) => {
      if (answeroption.isCorrect) {
        if (response.indexOf(answerIndex) > -1) {
          hasCorrectAnswers++;
        } else {
          hasWrongAnswers++;
        }
      } else {
        if (response.indexOf(answerIndex) > -1) {
          hasWrongAnswers++;
        }
      }
    });
    return !hasWrongAnswers && hasCorrectAnswers ? 1 : hasWrongAnswers && hasCorrectAnswers ? 0 : -1;
  }

  private isCorrectRangedQuestion(response: number, question: RangedQuestionEntity): number {
    if (typeof response === 'undefined' || typeof response !== 'number') {
      return -1;
    }

    return response === question.correctValue ? 1 : response >= question.rangeMin && response <= question.rangeMax ? 0 : -1;
  }

  private isCorrectFreeTextQuestion(response: string, question: FreeTextQuestionEntity): boolean {
    if (typeof response === 'undefined' || typeof response !== 'string') {
      return false;
    }

    const answerOption: FreeTextAnswerEntity = <FreeTextAnswerEntity>question.answerOptionList[0];
    let refValue = answerOption.answerText;
    let result = false;

    if (!answerOption.configCaseSensitive) {
      refValue = refValue.toLowerCase();
      response = response.toLowerCase();
      result = refValue === response;
    }
    if (answerOption.configTrimWhitespaces) {
      refValue = refValue.replace(/ /g, '');
      response = response.replace(/ /g, '');
      result = refValue === response;
    } else {
      if (!answerOption.configUsePunctuation) {
        refValue = refValue.replace(/[,:\(\)\[\]\.\*\?]/g, '');
        response = response.replace(/[,:\(\)\[\]\.\*\?]/g, '');
      }
      if (!answerOption.configUseKeywords) {
        result = refValue.split(' ').filter((elem) => {
          return response.indexOf(elem) === -1;
        }).length === 0;
      } else {
        result = refValue === response;
      }
    }
    return result;
  }
}
