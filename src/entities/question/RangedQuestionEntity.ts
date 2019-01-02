import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractQuestionEntity } from './AbstractQuestionEntity';

export class RangedQuestionEntity extends AbstractQuestionEntity {
  public TYPE = QuestionType.RangedQuestion;

  private _rangeMin = 0;

  get rangeMin(): number {
    return this._rangeMin;
  }

  set rangeMin(value: number) {
    this._rangeMin = value;
  }

  private _rangeMax = 0;

  get rangeMax(): number {
    return this._rangeMax;
  }

  set rangeMax(value: number) {
    this._rangeMax = value;
  }

  private _correctValue = 0;

  get correctValue(): number {
    return this._correctValue;
  }

  set correctValue(value: number) {
    this._correctValue = value;
  }

  constructor(props) {
    super(props);
    this.rangeMax = props.rangeMax;
    this.rangeMin = props.rangeMin;
    this.correctValue = props.correctValue;
  }

  public isValid(): boolean {
    return super.isValid() && //
           this.answerOptionList.length === 0 && //
           this.rangeMin < this.rangeMax && //
           this.correctValue >= this.rangeMin && //
           this.correctValue <= this.rangeMax;
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), {
      TYPE: this.TYPE,
      rangeMin: this.rangeMin,
      rangeMax: this.rangeMax,
      correctValue: this.correctValue,
    });
  }
}
