import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { SingleChoiceQuestionEntity } from './SingleChoiceQuestionEntity';

export class YesNoSingleChoiceQuestionEntity extends SingleChoiceQuestionEntity {
  public TYPE = QuestionType.YesNoSingleChoiceQuestion;

  constructor(props) {
    super(props);
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), { TYPE: this.TYPE });
  }
}
