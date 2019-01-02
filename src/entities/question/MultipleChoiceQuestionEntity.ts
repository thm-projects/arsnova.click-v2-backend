import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractChoiceQuestionEntity } from './AbstractChoiceQuestionEntity';

export class MultipleChoiceQuestionEntity extends AbstractChoiceQuestionEntity {
  public TYPE = QuestionType.MultipleChoiceQuestion;

  constructor(props) {
    super(props);
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), { TYPE: this.TYPE });
  }
}

