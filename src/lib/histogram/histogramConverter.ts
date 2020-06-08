import { IHistData } from '../../interfaces/IHistData';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';

export class HistogramConverter {

  public static convertABCDSingleChoiceQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertFreeTextQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertMultipleChoiceQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertRangedQuestion(
    questionData: IQuestionRanged,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {

    const data: Array<IHistData> = [];

    for (let i = questionData.rangeMin; i <= questionData.rangeMax; i++) {
      data[i] = {
        key: i.toString(),
        val: 0
      };
    }

    responsesRaw.forEach(response => data[<number>response.value].val++);

    return data;
  }

  public static convertSingleChoiceQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertSurveyQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertTrueFalseSingleChoiceQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertYesNoSingleChoiceQuestion(
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

}
