import { AnswerType } from '../../enums/AnswerType';
import { AbstractEntity } from '../AbstractEntity';

export abstract class AbstractAnswerEntity extends AbstractEntity {
  public abstract TYPE: AnswerType;
  public answerText: string;
  public isCorrect: boolean;

  protected constructor({ answerText, isCorrect = false }: { answerText: string, isCorrect?: boolean }) {
    super();

    this.answerText = answerText;
    this.isCorrect = isCorrect;
  }

  public serialize(): any {
    return {
      answerText: this.answerText,
      isCorrect: this.isCorrect,
    };
  }

  public isValid(): boolean {
    return this.answerText.replace(/ /g, '').length > 0;
  }
}
