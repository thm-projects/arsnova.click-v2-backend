import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { SingleChoiceQuestionEntity } from './SingleChoiceQuestionEntity';

export class TrueFalseSingleChoiceQuestionEntity extends SingleChoiceQuestionEntity {
  public TYPE = QuestionType.TrueFalseSingleChoiceQuestion;

  constructor(props) {
    super(props);
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), { TYPE: this.TYPE });
  }
}
