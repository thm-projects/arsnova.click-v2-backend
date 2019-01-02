import { IAnswerBase, IAnswerEntity } from './IAnswerEntity';
import { IFreetextAnswerBase } from './IFreetextAnswerBase';
import { IFreetextAnswerBaseConfiguration } from './IFreetextAnswerBaseConfiguration';

export interface IFreetextAnswerEntity extends IFreetextAnswerBase, IAnswerEntity {

  isCorrectInput(ref: string): boolean;

  setConfig(configIdentifier: string, configValue: boolean): void;

  getConfig(): Array<IFreetextAnswerBaseConfiguration>;

  serialize(): IFreetextAnswerBase & IAnswerBase;

  equals(answerOption: IFreetextAnswerEntity): boolean;
}
