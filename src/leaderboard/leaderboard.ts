import {IFreetextAnswerOption} from 'arsnova-click-v2-types/src/answeroptions/interfaces';
import {IQuizResponse, ILeaderBoardItem} from 'arsnova-click-v2-types/src/common';
import {IQuestionChoice, IQuestionRanged, IQuestionFreetext, IQuestion} from 'arsnova-click-v2-types/src/questions/interfaces';

export class Leaderboard {
  private isCorrectSingleChoiceQuestion(response: number, question: IQuestionChoice): boolean {
    return question.answerOptionList[response].isCorrect;
  }

  private isCorrectMultipleChoiceQuestion(response: Array<number>, question: IQuestionChoice): number {
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

  private isCorrectRangedQuestion(response: number, question: IQuestionRanged): number {
    return response === question.correctValue ? 1 : response >= question.rangeMin && response <= question.rangeMax ? 0 : -1;
  }

  private isCorrectFreeTextQuestion(response: string, question: IQuestionFreetext): boolean {
    const answerOption: IFreetextAnswerOption = <IFreetextAnswerOption>question.answerOptionList[0];
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
        result = refValue.split(' ').filter(function (elem) {
          return response.indexOf(elem) === -1;
        }).length === 0;
      } else {
        result = refValue === response;
      }
    }
    return result;
  }

  public isCorrectResponse(response: IQuizResponse, question: IQuestion): number {
    switch (question.TYPE) {
      case 'SingleChoiceQuestion':
      case 'YesNoSingleChoiceQuestion':
      case 'TrueFalseSingleChoiceQuestion':
        return this.isCorrectSingleChoiceQuestion(<number>response.value, <IQuestionChoice>question) ? 1 : -1;
      case 'MultipleChoiceQuestion':
        return this.isCorrectMultipleChoiceQuestion(<Array<number>>response.value, <IQuestionChoice>question);
      case 'ABCDSingleChoiceQuestion':
      case 'SurveyQuestion':
        return 1;
      case 'RangedQuestion':
        return this.isCorrectRangedQuestion(<number>response.value, <IQuestionRanged>question);
      case 'FreeTextQuestion':
        return this.isCorrectFreeTextQuestion(<string>response.value, <IQuestionFreetext>question) ? 1 : -1;
      default:
        throw new Error(`Unsupported question type while checking correct response. Received type ${question.TYPE}`);
    }
  }

  public objectToArray(obj: Object): Array<ILeaderBoardItem> {
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
        score: obj[value].score
      };
    });
  }
}
