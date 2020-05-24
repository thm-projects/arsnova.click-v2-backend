import { Document } from 'mongoose';
import MemberDAO from '../../db/MemberDAO';
import { AnswerState } from '../../enums/AnswerState';
import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { QuestionType } from '../../enums/QuestionType';
import { IAnswerResult } from '../../interfaces/IAnswerResult';
import { ILeaderBoardItemBase } from '../../interfaces/leaderboard/ILeaderBoardItemBase';
import { IQuestionBase } from '../../interfaces/questions/IQuestion';
import { IQuestionChoice } from '../../interfaces/questions/IQuestionChoice';
import { IQuestionFreetext } from '../../interfaces/questions/IQuestionFreetext';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';
import { IQuizBase } from '../../interfaces/quizzes/IQuizEntity';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { MemberModelItem } from '../../models/member/MemberModel';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import LoggerService from '../../services/LoggerService';
import { publicSettings } from '../../statistics';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';
import { PointBasedLeaderboardScore } from './PointBasedLeaderboardScore';
import { TimeBasedLeaderboardScore } from './TimeBasedLeaderboardScore';

export class Leaderboard {
  private readonly _timebasedLeaderboard: AbstractLeaderboardScore = new TimeBasedLeaderboardScore();
  private readonly _pointbasedLeaderboard: AbstractLeaderboardScore = new PointBasedLeaderboardScore();
  private readonly _defaultLeaderboard: AbstractLeaderboardScore;

  constructor() {
    switch (publicSettings.leaderboardAlgorithm) {
      case LeaderboardConfiguration.TimeBased:
        this._defaultLeaderboard = this._timebasedLeaderboard;
        break;
      case LeaderboardConfiguration.PointBased:
        this._defaultLeaderboard = this._pointbasedLeaderboard;
        break;
      default:
    }
  }

  public isCorrectResponse(response: IQuizResponse, question: IQuestionBase): number {
    switch (question.TYPE) {
      case QuestionType.SingleChoiceQuestion:
      case QuestionType.YesNoSingleChoiceQuestion:
      case QuestionType.TrueFalseSingleChoiceQuestion:
        return this.isCorrectSingleChoiceQuestion(response.value[0] as number, question as IQuestionChoice) ? 1 : -1;
      case QuestionType.MultipleChoiceQuestion:
        return this.isCorrectMultipleChoiceQuestion(response.value as Array<number>, question as IQuestionChoice);
      case QuestionType.ABCDSingleChoiceQuestion:
      case QuestionType.SurveyQuestion:
        return 1;
      case QuestionType.RangedQuestion:
        return this.isCorrectRangedQuestion(parseInt(String(response.value), 10), question as IQuestionRanged);
      case QuestionType.FreeTextQuestion:
        return this.isCorrectFreeTextQuestion(response.value as string, question as IQuestionFreetext) ? 1 : -1;
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

  public async buildLeaderboard(activeQuiz: IQuizBase, questionIndex?: number, attendeeName?: string): Promise<any> {
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
    const members = await MemberDAO.getMembersOfQuiz(activeQuiz.name);

    const groups = activeQuiz.sessionConfig.nicks.memberGroups.length > 0 ? activeQuiz.sessionConfig.nicks.memberGroups : [{name: 'Default'}];
    groups.forEach((memberGroup) => {
      const membersOfGroup = members
        .filter(attendee => attendeeName ? attendee.name === attendeeName : true)
        .filter(member => member.groupName === memberGroup.name);

      memberGroupResults[memberGroup.name] = {
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
          const question = activeQuiz.questionList[i] as IQuestionChoice;
          if ([QuestionType.SurveyQuestion, QuestionType.ABCDSingleChoiceQuestion].includes(question.TYPE)) {
            continue;
          }
          const responseTime = attendee.responses[i].responseTime;

          if (!responses[attendee.name]) {
            responses[attendee.name] = {
              responseTime: responseTime,
              correctQuestions: [],
              confidenceValue: attendee.responses[i].confidence,
              score: 0,
            };
          }

          memberGroupResults[memberGroup.name].responseTime += responseTime;

          const isCorrect = this.isCorrectResponse(attendee.responses[i], question);
          if (isCorrect === 1) {
            responses[attendee.name].correctQuestions.push(i);
            responses[attendee.name].score += question.difficulty * scoringLeaderboard.getScoreForCorrect(responseTime, question.timer);

            memberGroupResults[memberGroup.name].correctQuestions.push(i);
            memberGroupResults[memberGroup.name].score += responses[attendee.name].score;

          } else if (isCorrect === 0) {
            responses[attendee.name].correctQuestions.push(i);
            responses[attendee.name].score += question.difficulty * scoringLeaderboard.getScoreForPartiallyCorrect(responseTime, question.timer);

            memberGroupResults[memberGroup.name].correctQuestions.push(i);
            memberGroupResults[memberGroup.name].score += responses[attendee.name].score;

          } else {
            responses[attendee.name].score += question.difficulty * scoringLeaderboard.getScoreForWrongAnswer(responseTime, question.timer);
            memberGroupResults[memberGroup.name].score += responses[attendee.name].score;
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

  public async getAnswerResult(attendee: Document & MemberModelItem, quiz: Document & QuizModelItem): Promise<IAnswerResult> {
    let scoringLeaderboard: AbstractLeaderboardScore;
    if (quiz.sessionConfig.leaderboardAlgorithm === LeaderboardConfiguration.TimeBased) {
      scoringLeaderboard = this._timebasedLeaderboard;
    } else if (quiz.sessionConfig.leaderboardAlgorithm === LeaderboardConfiguration.PointBased) {
      scoringLeaderboard = this._pointbasedLeaderboard;
    } else {
      scoringLeaderboard = this._defaultLeaderboard;
    }

    const { correctResponses, memberGroupResults } = await this.buildLeaderboard(quiz, quiz.currentQuestionIndex);
    const orderByGroups = quiz.sessionConfig.nicks.memberGroups.length > 0;

    const response = attendee.responses[quiz.currentQuestionIndex];
    const question = quiz.questionList[quiz.currentQuestionIndex];
    const correctState = this.isCorrectResponse(response, question);
    const state = correctState === 1 ? AnswerState.Correct : correctState === 0 ? AnswerState.PartiallyCorrect : AnswerState.Wrong;
    const amountCorrect = this.getCorrectAnswers(Array.isArray(response.value) ? response.value : [response.value], question);

    let pointsGained: number;
    let amountAvailable: number;
    let rank: number;

    if (orderByGroups) {
      rank = this.sortBy(memberGroupResults, 'score').findIndex(value => value.name === attendee.groupName) + 1;
      pointsGained = memberGroupResults[attendee.groupName].score;
    } else {
      rank = this.sortBy(correctResponses, 'score').findIndex(value => value.name === attendee.name) + 1;

      if (state === AnswerState.Correct) {
        pointsGained = question.difficulty * scoringLeaderboard.getScoreForCorrect(response.responseTime, question.timer);
      } else if (state === AnswerState.PartiallyCorrect) {
        pointsGained = question.difficulty * scoringLeaderboard.getScoreForPartiallyCorrect(response.responseTime, question.timer);
      } else {
        pointsGained = question.difficulty * scoringLeaderboard.getScoreForWrongAnswer(response.responseTime, question.timer);
      }
    }

    if ([QuestionType.SurveyQuestion, QuestionType.ABCDSingleChoiceQuestion].includes(question.TYPE)) {
      amountAvailable = 0;
    } else if ([QuestionType.RangedQuestion, QuestionType.FreeTextQuestion].includes(question.TYPE)) {
      amountAvailable = 1;
    } else {
      amountAvailable = question.answerOptionList.filter(answer => answer.isCorrect).length;
    }

    return {state, pointsGained, rank, amountAvailable, amountCorrect};
  }

  private isCorrectSingleChoiceQuestion(response: number, question: IQuestionChoice): boolean {
    if (typeof response === 'undefined' || typeof response !== 'number' || !question.answerOptionList[response]) {
      return false;
    }

    return question.answerOptionList[response] && question.answerOptionList[response].isCorrect;
  }

  private getCorrectAnswers(response: Array<string | number>, question: IQuestionBase): number {
    switch (question.TYPE) {
      case QuestionType.ABCDSingleChoiceQuestion:
      case QuestionType.SurveyQuestion:
        return 0;
      case QuestionType.FreeTextQuestion:
        return this.isCorrectFreeTextQuestion(response[0] as string, question as IQuestionFreetext) ? 1 : 0;
      case QuestionType.RangedQuestion:
        return this.isCorrectRangedQuestion(response[0] as number, question as IQuestionRanged) ? 1 : 0;
      case QuestionType.MultipleChoiceQuestion:
        const {correct} = this.getMultipleChoiceAnswerResult(response as Array<number>, question as IQuestionChoice);
        return correct;
      case QuestionType.SingleChoiceQuestion:
      case QuestionType.TrueFalseSingleChoiceQuestion:
      case QuestionType.YesNoSingleChoiceQuestion:
        return this.isCorrectSingleChoiceQuestion(response[0] as number, question as IQuestionChoice) ? 1 : 0;
    }
  }

  private getMultipleChoiceAnswerResult(response: Array<number>, question: IQuestionChoice): {correct: number, wrong: number} {
    let correct = 0;
    let wrong = 0;
    question.answerOptionList.forEach((answeroption, answerIndex) => {
      if (answeroption.isCorrect) {
        if (response.indexOf(answerIndex) > -1) {
          correct++;
        } else {
          wrong++;
        }
      } else {
        if (response.indexOf(answerIndex) > -1) {
          wrong++;
        }
      }
    });
    return {correct, wrong};
  }

  private isCorrectMultipleChoiceQuestion(response: Array<number>, question: IQuestionChoice): number {
    if (!Array.isArray(response)) {
      return -1;
    }

    const {correct, wrong} = this.getMultipleChoiceAnswerResult(response, question);

    return !wrong && correct ? 1 : wrong && correct ? 0 : -1;
  }

  private isCorrectRangedQuestion(response: number, question: IQuestionRanged): number {
    if (typeof response === 'undefined' || typeof response !== 'number') {
      return -1;
    }

    return response === question.correctValue ? 1 : response >= question.rangeMin && response <= question.rangeMax ? 0 : -1;
  }

  private isCorrectFreeTextQuestion(response: string, question: IQuestionFreetext): boolean {
    if (typeof response === 'undefined' || typeof response !== 'string') {
      return false;
    }

    const answerOption = question.answerOptionList[0];
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
