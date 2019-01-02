import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractChoiceQuestionEntity } from './AbstractChoiceQuestionEntity';

export class SurveyQuestionEntity extends AbstractChoiceQuestionEntity {
  public TYPE = QuestionType.SurveyQuestion;

  private _multipleSelectionEnabled: boolean;

  get multipleSelectionEnabled(): boolean {
    return this._multipleSelectionEnabled;
  }

  set multipleSelectionEnabled(value: boolean) {
    this._multipleSelectionEnabled = value;
  }

  constructor(props) {
    super(props);
    this.multipleSelectionEnabled = props.multipleSelectionEnabled;
  }

  public isValid(): boolean {
    const correctAnswers = this.answerOptionList.filter(answeroption => answeroption.isCorrect).length;
    return super.isValid() && correctAnswers === 0;
  }

  public serialize(): IQuestionSerialized {
    return Object.assign(super.serialize(), {
      TYPE: this.TYPE,
      multipleSelectionEnabled: this.multipleSelectionEnabled,
    });
  }
}
