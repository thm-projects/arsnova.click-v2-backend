import { Document } from 'mongoose';
import { AnswerState } from '../../enums/AnswerState';
import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { QuestionType } from '../../enums/QuestionType';
import { IAnswerResult } from '../../interfaces/IAnswerResult';
import { ILeaderBoardItemBase } from '../../interfaces/leaderboard/ILeaderBoardItemBase';
import { IQuestion, IQuestionBase } from '../../interfaces/questions/IQuestion';
import { IQuestionChoice } from '../../interfaces/questions/IQuestionChoice';
import { IQuestionFreetext } from '../../interfaces/questions/IQuestionFreetext';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';
import { IQuizBase } from '../../interfaces/quizzes/IQuizEntity';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { MemberModel, MemberModelItem } from '../../models/member/MemberModel';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import { publicSettings } from '../../statistics';
import { AbstractLeaderboardScore } from './AbstractLeaderboardScore';
import { PointBasedLeaderboardScore } from './PointBasedLeaderboardScore';
import { TimeBasedLeaderboardScore } from './TimeBasedLeaderboardScore';

function selectLeaderboard(algorithm: LeaderboardConfiguration = publicSettings.leaderboardAlgorithm): AbstractLeaderboardScore {
  switch (algorithm) {
    case LeaderboardConfiguration.TimeBased:
      return new TimeBasedLeaderboardScore();
    case LeaderboardConfiguration.PointBased:
      return new PointBasedLeaderboardScore();
    default:
  }
}

export class Leaderboard {
  public static getRankingForGroup(quiz: IQuizBase, questionIndex?: number): Promise<Array<ILeaderBoardItemBase>> {
    return MemberModel.aggregate([
      { $match: { currentQuizName: quiz.name } },
      { $project: {
          groupName: '$groupName',
          responses: { $slice: [ '$responses', questionIndex ?? quiz.questionList.length ] },
          name: '$name'
        }
      },
      { $group: {
          _id: '$groupName',
          names: { $push: '$name' },
          responseTimes: { $sum: { $sum: '$responses.responseTime' } },
          confidence: { $avg: { $sum: '$responses.confidence' } },
          responses: { $push: '$responses' },
          score: { $sum: { $sum: '$responses.score' } }
        }
      },
      { $sort: { score: -1 } },
    ]).exec();
  }

  public static async getCorrectResponses(quiz: IQuizBase, questionIndex?: number, attendeeName?: string): Promise<Array<ILeaderBoardItemBase>> {
    const questionAmount: number = quiz.questionList.length;
    const endIndex: number = isNaN(questionIndex) || questionIndex < 0 || questionIndex > questionAmount ? questionAmount : questionIndex + 1;
    const ranking = await Leaderboard.getRanking(quiz, endIndex, attendeeName);

    return ranking.map(rankedMember => {
      const item: ILeaderBoardItemBase = {
        score: rankedMember.score,
        confidenceValue: rankedMember.confidence,
        correctQuestions: quiz.questionList.slice(0, endIndex).map((question, index) => {
          const answerResult = this.getAnswerStateForResponse(rankedMember.responses[index].value, question as IQuestion);
          if (answerResult === AnswerState.Correct) {
            return index;
          }
          return -1;
        }).filter(v => v !== -1),
        name: rankedMember.name,
        responseTime: rankedMember.responseTime
      };

      return item;
    });
  }

  public static async getAnswerResult(attendee: Document & MemberModelItem, quiz: Document & QuizModelItem): Promise<IAnswerResult> {
    const index = quiz.currentQuestionIndex;
    const response = attendee.responses[index];
    const question = quiz.questionList[index];
    const amountCorrect = this.getCorrectAnswers(Array.isArray(response.value) ? response.value : [response.value], question);
    let amountWrong = 0;
    let amountAvailable: number;

    if ([QuestionType.SurveyQuestion, QuestionType.ABCDSingleChoiceQuestion].includes(question.TYPE)) {
      amountAvailable = 0;
    } else if ([QuestionType.RangedQuestion, QuestionType.FreeTextQuestion].includes(question.TYPE)) {
      amountAvailable = 1;
    } else {
      amountAvailable = question.answerOptionList.filter(answer => answer.isCorrect).length;

      if ([QuestionType.MultipleChoiceQuestion].includes(question.TYPE)) {
        amountWrong = this.getMultipleChoiceAnswerResult(response.value as Array<number>, question as IQuestionChoice).wrong;
      }
    }

    return {
      pointsGained: this.getScoreForResponse(quiz, response.value, response.responseTime),
      state: this.getAnswerStateForResponse(response.value, question),
      amountCorrect,
      amountWrong,
      amountAvailable,
      rank: await this.getMemberRank({
        quiz,
        questionIndex: index,
        nickName: attendee.name
      })
    };
  }

  public static getAnswerStateForResponse(data: string | number | Array<number>, question: IQuestionBase): AnswerState {
    switch (question.TYPE) {
      case QuestionType.SingleChoiceQuestion:
      case QuestionType.YesNoSingleChoiceQuestion:
      case QuestionType.TrueFalseSingleChoiceQuestion:
        return Leaderboard.isCorrectSingleChoiceQuestion(data[0] as number, question as IQuestionChoice) ? AnswerState.Correct : AnswerState.Wrong;
      case QuestionType.MultipleChoiceQuestion:
        return this.isCorrectMultipleChoiceQuestion(data as Array<number>, question as IQuestionChoice);
      case QuestionType.ABCDSingleChoiceQuestion:
      case QuestionType.SurveyQuestion:
        return AnswerState.Wrong;
      case QuestionType.RangedQuestion:
        return Leaderboard.isCorrectRangedQuestion(parseInt(String(data), 10), question as IQuestionRanged);
      case QuestionType.FreeTextQuestion:
        return this.isCorrectFreeTextQuestion(data as string, question as IQuestionFreetext) ? AnswerState.Correct : AnswerState.Wrong;
      default:
        throw new Error(`Unsupported question type while checking correct response. Received type ${question.TYPE}`);
    }
  }

  public static getScoreForResponse(quiz: Document & QuizModelItem, data: string | number | Array<number>, responseTime: number): number {
    const scoringLeaderboard = selectLeaderboard(quiz.sessionConfig.leaderboardAlgorithm);
    const question = quiz.questionList[quiz.currentQuestionIndex];
    const state = this.getAnswerStateForResponse(data, question);

    if (state === AnswerState.Correct) {
      return question.difficulty * scoringLeaderboard.getScoreForCorrect(responseTime, question.timer);
    } else if (![QuestionType.MultipleChoiceQuestion].includes(question.TYPE) && state === AnswerState.PartiallyCorrect) {
      return question.difficulty * scoringLeaderboard.getScoreForPartiallyCorrect(responseTime, question.timer);
    }

    return question.difficulty * scoringLeaderboard.getScoreForWrongAnswer(responseTime, question.timer);
  }

  private static getRanking(
    quiz: IQuizBase, questionIndex?: number, attendeeName?: string
  ): Promise<Array<{name: string, score: number, responseTime: number, confidence: number, responses: Array<IQuizResponse>}>> {
    const matchQuery: any = {};
    if (attendeeName) {
      matchQuery.$match = { $and: [ { currentQuizName: quiz.name }, { name: attendeeName } ] };
    } else {
      matchQuery.$match = { currentQuizName: quiz.name };
    }

    return MemberModel.aggregate([
      matchQuery,
      { $project: {
          _id: 0,
          name: 1,
          responseTime: { $sum: '$responses.responseTime' },
          confidence: { $avg: '$responses.confidence' },
          responses: { $slice: [ '$responses', questionIndex ?? quiz.questionList.length ] },
        }
      },
      { $addFields: { score: { $sum: [ '$responses.score' ] } } },
      { $sort: { score: -1 } },
    ]).exec();
  }

  private static async getMemberRank(
    { quiz, questionIndex, nickName }: { quiz: Document & QuizModelItem, questionIndex?: number, nickName: string }
  ): Promise<number> {
    if (!nickName) {
      throw new Error('No nickname für Leaderboard.#getMemberRank defined');
    }

    const ranking = await Leaderboard.getRanking(quiz, questionIndex);
    const rank = ranking.findIndex(v => v.name === nickName);
    if (rank === -1) {
      throw new Error(`Nickname '${nickName}' has no rank in quiz '${quiz.name}' (was filtering for questionIndex '${questionIndex}')`);
    }

    return rank + 1;
  }

  private static isCorrectSingleChoiceQuestion(response: number, question: IQuestionChoice): boolean {
    if (typeof response === 'undefined' || typeof response !== 'number' || !question.answerOptionList[response]) {
      return false;
    }

    return question.answerOptionList[response] && question.answerOptionList[response].isCorrect;
  }

  private static getCorrectAnswers(response: Array<string | number>, question: IQuestionBase): number {
    switch (question.TYPE) {
      case QuestionType.ABCDSingleChoiceQuestion:
      case QuestionType.SurveyQuestion:
        return 0;
      case QuestionType.FreeTextQuestion:
        return this.isCorrectFreeTextQuestion(response[0] as string, question as IQuestionFreetext) ? 1 : 0;
      case QuestionType.RangedQuestion:
        return Leaderboard.isCorrectRangedQuestion(response[0] as number, question as IQuestionRanged) ? 1 : 0;
      case QuestionType.MultipleChoiceQuestion:
        const {correct} = this.getMultipleChoiceAnswerResult(response as Array<number>, question as IQuestionChoice);
        return correct;
      case QuestionType.SingleChoiceQuestion:
      case QuestionType.TrueFalseSingleChoiceQuestion:
      case QuestionType.YesNoSingleChoiceQuestion:
        return Leaderboard.isCorrectSingleChoiceQuestion(response[0] as number, question as IQuestionChoice) ? 1 : 0;
    }
  }

  private static getMultipleChoiceAnswerResult(response: Array<number>, question: IQuestionChoice): {correct: number, wrong: number, missed: number} {
    let correct = 0;
    let wrong = 0;
    let missed = 0;
    question.answerOptionList.forEach((answeroption, answerIndex) => {
      if (answeroption.isCorrect) {
        if (response.indexOf(answerIndex) > -1) {
          correct++;
        } else {
          missed++;
        }
      } else {
        if (response.indexOf(answerIndex) > -1) {
          wrong++;
        }
      }
    });
    return {correct, wrong, missed};
  }

  private static isCorrectMultipleChoiceQuestion(response: Array<number>, question: IQuestionChoice): AnswerState {
    if (!Array.isArray(response)) {
      return AnswerState.Wrong;
    }

    const {correct, wrong, missed} = this.getMultipleChoiceAnswerResult(response, question);

    return !wrong && !missed && correct ? AnswerState.Correct : (wrong && correct) || missed ? AnswerState.PartiallyCorrect : AnswerState.Wrong;
  }

  private static isCorrectRangedQuestion(response: number, question: IQuestionRanged): AnswerState {
    if (typeof response === 'undefined' || typeof response !== 'number') {
      return AnswerState.Wrong;
    }

    return response === question.correctValue ?
           AnswerState.Correct : response >= question.rangeMin && response <= question.rangeMax ?
                                 AnswerState.PartiallyCorrect : AnswerState.Wrong;
  }

  private static isCorrectFreeTextQuestion(response: string, question: IQuestionFreetext): boolean {
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
