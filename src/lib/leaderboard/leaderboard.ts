import { FreeTextAnswerEntity } from '../../entities/answer/FreetextAnwerEntity';
import { AbstractChoiceQuestionEntity } from '../../entities/question/AbstractChoiceQuestionEntity';
import { AbstractQuestionEntity } from '../../entities/question/AbstractQuestionEntity';
import { FreeTextQuestionEntity } from '../../entities/question/FreeTextQuestionEntity';
import { RangedQuestionEntity } from '../../entities/question/RangedQuestionEntity';
import { QuestionType } from '../../enums/QuestionType';
import { ILeaderBoardItemBase } from '../../interfaces/leaderboard/ILeaderBoardItemBase';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';

export class Leaderboard {
  public isCorrectResponse(response: IQuizResponse, question: AbstractQuestionEntity): number {
    switch (question.TYPE) {
      case QuestionType.SingleChoiceQuestion:
      case QuestionType.YesNoSingleChoiceQuestion:
      case QuestionType.TrueFalseSingleChoiceQuestion:
        return this.isCorrectSingleChoiceQuestion(<number>response.value, <AbstractChoiceQuestionEntity>question) ? 1 : -1;
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
    });
  }

  private isCorrectSingleChoiceQuestion(response: number, question: AbstractChoiceQuestionEntity): boolean {
    return question.answerOptionList[response].isCorrect;
  }

  private isCorrectMultipleChoiceQuestion(response: Array<number>, question: AbstractChoiceQuestionEntity): number {
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
    return response === question.correctValue ? 1 : response >= question.rangeMin && response <= question.rangeMax ? 0 : -1;
  }

  private isCorrectFreeTextQuestion(response: string, question: FreeTextQuestionEntity): boolean {
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
