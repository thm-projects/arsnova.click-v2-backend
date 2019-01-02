import { AnswerType } from '../../enums/AnswerType';
import { AbstractAnswerEntity } from './AbstractAnswerEntity';

export class DefaultAnswerEntity extends AbstractAnswerEntity {
  public readonly TYPE = AnswerType.DefaultAnswerOption;

  constructor({ answerText, isCorrect = false }: { answerText?: string, isCorrect?: boolean }) {
    super({
      answerText,
      isCorrect,
    });
  }

  public serialize(): any {
    return Object.assign(super.serialize(), {
      TYPE: this.TYPE,
    });
  }
}
