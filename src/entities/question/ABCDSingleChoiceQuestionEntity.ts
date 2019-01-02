import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { SingleChoiceQuestionEntity } from './SingleChoiceQuestionEntity';

export class ABCDSingleChoiceQuestionEntity extends SingleChoiceQuestionEntity {
  public TYPE = QuestionType.ABCDSingleChoiceQuestion;

  constructor(props) {
    super(props);
  }

  public isValid(): boolean {
    return true;
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), { TYPE: this.TYPE });
  }
}
