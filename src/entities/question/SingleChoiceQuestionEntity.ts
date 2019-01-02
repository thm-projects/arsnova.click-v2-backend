import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractChoiceQuestionEntity } from './AbstractChoiceQuestionEntity';

export class SingleChoiceQuestionEntity extends AbstractChoiceQuestionEntity {
  public TYPE = QuestionType.SingleChoiceQuestion;

  constructor(props) {
    super(props);
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), { TYPE: this.TYPE });
  }

  public isValid(): boolean {
    const hasValidAnswer = this.answerOptionList.filter(answeroption => answeroption.isCorrect).length;
    return super.isValid() && hasValidAnswer === 1;
  }
}
