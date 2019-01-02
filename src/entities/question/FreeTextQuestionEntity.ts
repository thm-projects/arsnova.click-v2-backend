import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractQuestionEntity } from './AbstractQuestionEntity';

export class FreeTextQuestionEntity extends AbstractQuestionEntity {
  public TYPE = QuestionType.FreeTextQuestion;

  constructor(props) {
    super(props);
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), {
      TYPE: this.TYPE,
    });
  }

  public isValid(): boolean {
    return super.isValid() && this.answerOptionList.length === 1 && this.answerOptionList[0].isValid();
  }
}
