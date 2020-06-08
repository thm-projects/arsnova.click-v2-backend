import { IHistData } from '../../interfaces/IHistData';
import { IQuestion } from '../../interfaces/questions/IQuestion';
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
    questionData: IQuestion,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [
      {
        key: 'A',
        val: 13
      },
      {
        key: 'B',
        val: 9
      },
      {
        key: 'C',
        val: 5
      },
      {
        key: 'D',
        val: 14
      },
    ];
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
