import { IHistData } from '../../interfaces/IHistData';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { IQuestionChoice } from '../../interfaces/questions/IQuestionChoice';
import { IQuestionFreetext } from '../../interfaces/questions/IQuestionFreetext';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';
import { IQuestionSurvey } from '../../interfaces/questions/IQuestionSurvey';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { RangedQuestionBucketScale } from './rangedQuestionBucketScale';

export class HistogramConverter {

  public static convertABCDSingleChoiceQuestion(
    questionData: IQuestionChoice,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertFreeTextQuestion(
    questionData: IQuestionFreetext,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertMultipleChoiceQuestion(
    questionData: IQuestionChoice,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertRangedQuestion(
    questionData: IQuestionRanged,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {

    const bucketScale = new RangedQuestionBucketScale(questionData);

    responsesRaw.forEach(response => bucketScale.addValue(<number>response.value));
    bucketScale.calculatePercentages();

    return bucketScale.getBuckets();
  }

  public static convertSingleChoiceQuestion(
    questionData: IQuestionChoice,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertSurveyQuestion(
    questionData: IQuestionSurvey,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertTrueFalseSingleChoiceQuestion(
    questionData: IQuestionChoice,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

  public static convertYesNoSingleChoiceQuestion(
    questionData: IQuestionChoice,
    responsesRaw: Array<IQuizResponse>
  ): Array<IHistData> {
    return [];
  }

}
