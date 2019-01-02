import { AnswerType } from '../../enums/AnswerType';
import { IFreetextAnswerBase } from '../../interfaces/answeroptions/IFreetextAnswerBase';
import { AbstractAnswerEntity } from './AbstractAnswerEntity';

export class FreeTextAnswerEntity extends AbstractAnswerEntity {
  public TYPE = AnswerType.FreeTextAnswerOption;

  private _configCaseSensitive: boolean;

  get configCaseSensitive(): boolean {
    return this._configCaseSensitive;
  }

  set configCaseSensitive(value: boolean) {
    this._configCaseSensitive = value;
  }

  private _configTrimWhitespaces: boolean;

  get configTrimWhitespaces(): boolean {
    return this._configTrimWhitespaces;
  }

  set configTrimWhitespaces(value: boolean) {
    this._configTrimWhitespaces = value;
  }

  private _configUseKeywords: boolean;

  get configUseKeywords(): boolean {
    return this._configUseKeywords;
  }

  set configUseKeywords(value: boolean) {
    this._configUseKeywords = value;
  }

  private _configUsePunctuation: boolean;

  get configUsePunctuation(): boolean {
    return this._configUsePunctuation;
  }

  set configUsePunctuation(value: boolean) {
    this._configUsePunctuation = value;
  }

  constructor(props) {
    super(props);
    this._configCaseSensitive = props.configCaseSensitive;
    this._configTrimWhitespaces = props.configTrimWhitespaces;
    this._configUseKeywords = props.configUseKeywords;
    this._configUsePunctuation = props.configUsePunctuation;
  }

  public isCorrectInput(ref: string): boolean {
    let refValue = this.answerText;
    let result = false;
    if (!this.configCaseSensitive) {
      refValue = refValue.toLowerCase();
      ref = ref.toLowerCase();
      result = refValue === ref;
    }
    if (this.configTrimWhitespaces) {
      refValue = refValue.replace(/ /g, '');
      ref = ref.replace(/ /g, '');
      result = refValue === ref;
    } else {
      if (!this.configUsePunctuation) {
        refValue = refValue.replace(/[,:\(\)\[\]\.\*\?]/g, '');
        ref = ref.replace(/[,:\(\)\[\]\.\*\?]/g, '');
      }
      if (!this.configUseKeywords) {
        result = refValue.split(' ').filter(elem => {
          return ref.indexOf(elem) === -1;
        }).length === 0;
      } else {
        result = refValue === ref;
      }
    }
    return result;
  }

  public serialize(): IFreetextAnswerBase {
    return Object.assign(super.serialize(), {
      configCaseSensitive: this.configCaseSensitive,
      configTrimWhitespaces: this.configTrimWhitespaces,
      configUseKeywords: this.configUseKeywords,
      configUsePunctuation: this.configUsePunctuation,
      TYPE: this.TYPE,
    });
  }
}
