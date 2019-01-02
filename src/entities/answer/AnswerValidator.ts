import { AnswerType } from '../../enums/AnswerType';
import { AbstractAnswerEntity } from './AbstractAnswerEntity';
import { DefaultAnswerEntity } from './DefaultAnswerEntity';
import { FreeTextAnswerEntity } from './FreetextAnwerEntity';

export const getAnswerForType = (type: AnswerType, data?: object): AbstractAnswerEntity => {
  switch (type) {
    case AnswerType.DefaultAnswerOption:
      return new DefaultAnswerEntity(data);
    case AnswerType.FreeTextAnswerOption:
      return new FreeTextAnswerEntity(data);
    default:
      throw new Error(`Cannot built question with type: ${type}`);
  }
};
