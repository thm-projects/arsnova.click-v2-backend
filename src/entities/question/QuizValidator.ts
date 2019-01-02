import { QuestionType } from '../../enums/QuestionType';
import { ABCDSingleChoiceQuestionEntity } from './ABCDSingleChoiceQuestionEntity';
import { AbstractQuestionEntity } from './AbstractQuestionEntity';
import { FreeTextQuestionEntity } from './FreeTextQuestionEntity';
import { MultipleChoiceQuestionEntity } from './MultipleChoiceQuestionEntity';
import { RangedQuestionEntity } from './RangedQuestionEntity';
import { SingleChoiceQuestionEntity } from './SingleChoiceQuestionEntity';
import { SurveyQuestionEntity } from './SurveyQuestionEntity';
import { TrueFalseSingleChoiceQuestionEntity } from './TrueFalseSingleChoiceQuestionEntity';
import { YesNoSingleChoiceQuestionEntity } from './YesNoSingleChoiceQuestionEntity';

export const getQuestionForType = (type: QuestionType | string, data = {}): AbstractQuestionEntity => {
  switch (type) {
    case QuestionType.FreeTextQuestion:
      return new FreeTextQuestionEntity(data);
    case QuestionType.ABCDSingleChoiceQuestion:
      return new ABCDSingleChoiceQuestionEntity(data);
    case QuestionType.YesNoSingleChoiceQuestion:
      return new YesNoSingleChoiceQuestionEntity(data);
    case QuestionType.TrueFalseSingleChoiceQuestion:
      return new TrueFalseSingleChoiceQuestionEntity(data);
    case QuestionType.SingleChoiceQuestion:
      return new SingleChoiceQuestionEntity(data);
    case QuestionType.MultipleChoiceQuestion:
      return new MultipleChoiceQuestionEntity(data);
    case QuestionType.RangedQuestion:
      return new RangedQuestionEntity(data);
    case QuestionType.SurveyQuestion:
      return new SurveyQuestionEntity(data);
    default:
      throw new Error(`Cannot built question with type: ${type}`);
  }
};
