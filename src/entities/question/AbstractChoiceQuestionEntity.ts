import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractQuestionEntity } from './AbstractQuestionEntity';

export abstract class AbstractChoiceQuestionEntity extends AbstractQuestionEntity {
  public showOneAnswerPerRow: boolean;

  protected constructor(props) {
    super(props);
    this.showOneAnswerPerRow = props.showOneAnswerPerRow;
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), {
      showOneAnswerPerRow: this.showOneAnswerPerRow,
    });
  }

  public isValid(): boolean {
    let hasValidAnswer = false;
    this.answerOptionList.forEach(answeroption => {
      if (answeroption.isCorrect) {
        hasValidAnswer = true;
      }
    });
    return super.isValid() && this.answerOptionList.length > 0 && hasValidAnswer;
  }
}

