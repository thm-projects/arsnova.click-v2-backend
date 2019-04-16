import { QuestionType } from '../../enums/QuestionType';
import { IQuestionSerialized } from '../../interfaces/questions/IQuestion';
import { AbstractAnswerEntity } from '../answer/AbstractAnswerEntity';
import { getAnswerForType } from '../answer/AnswerValidator';

export abstract class AbstractQuestionEntity {
  public abstract TYPE: QuestionType;

  private _questionText: string;

  get questionText(): string {
    return this._questionText;
  }

  set questionText(value: string) {
    this._questionText = value;
  }

  private _timer: number;

  get timer(): number {
    return this._timer;
  }

  set timer(value: number) {
    this._timer = value;
  }

  private _displayAnswerText: boolean;

  get displayAnswerText(): boolean {
    return this._displayAnswerText;
  }

  set displayAnswerText(value: boolean) {
    this._displayAnswerText = value;
  }

  private _answerOptionList: Array<AbstractAnswerEntity> = [];

  get answerOptionList(): Array<AbstractAnswerEntity> {
    return this._answerOptionList;
  }

  set answerOptionList(value: Array<AbstractAnswerEntity>) {
    this._answerOptionList = value;
  }

  protected constructor(props) {
    this.questionText = props.questionText;
    this.timer = props.timer;
    this.displayAnswerText = props.displayAnswerText;
    if (props.answerOptionList.length > 0) {
      this.answerOptionList = props.answerOptionList.map((answerOption: AbstractAnswerEntity) => getAnswerForType(answerOption.TYPE, answerOption));
    }
  }

  public serialize(): IQuestionSerialized {
    return {
      TYPE: this.TYPE,
      questionText: this.questionText,
      timer: this.timer,
      displayAnswerText: this.displayAnswerText,
      answerOptionList: this.answerOptionList.map(answer => answer.serialize()),
    };
  }

  public isValid(): boolean {
    let answerOptionListValid = true;
    this.answerOptionList.forEach(answerOption => {
      if (!answerOption.isValid()) {
        answerOptionListValid = false;
      }
    });
    const questionTextWithoutMarkdownChars = this.getQuestionTextWithoutMarkdownChars().length;

    // hard coded checkup values are ugly, but the schema import seems to be messed up here...
    return answerOptionListValid && questionTextWithoutMarkdownChars > 4 && questionTextWithoutMarkdownChars < 50001 && this.timer >= -1;
  }

  public getQuestionTextWithoutMarkdownChars(): string {
    return this.questionText.replace(/#/g, '').replace(/\*/g, '').replace(/1./g, '').replace(/\[/g, '').replace(/\]\(/g, '')
    .replace(/\)/g, '').replace(/- /g, '').replace(/ /g, '').replace(/\\\(/g, '').replace(/\\\)/g, '').replace(/$/g, '')
    .replace(/<hlcode>/g, '').replace(/<\/hlcode>/g, '').replace(/>/g, '');
  }
}
