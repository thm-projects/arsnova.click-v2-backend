import { ObjectId } from 'bson';
import CasDAO from '../../db/CasDAO';
import DbDAO from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IMemberEntity } from '../../interfaces/entities/Member/IMemberEntity';
import { IMemberSerialized } from '../../interfaces/entities/Member/IMemberSerialized';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { ICasData } from '../../interfaces/users/ICasData';
import { AbstractEntity } from '../AbstractEntity';

export class MemberEntity extends AbstractEntity implements IMemberEntity {
  private _currentQuizName: string;

  get currentQuizName(): string {
    return this._currentQuizName;
  }

  set currentQuizName(value: string) {
    this._currentQuizName = value;

    if (value) {
      this._responses = this.generateResponseForQuiz(QuizDAO.getQuizByName(value).questionList.length);
    }
  }

  private _token: string;

  get token(): string {
    return this._token;
  }

  set token(value: string) {
    this._token = value;
  }

  private _name: string;

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  private _groupName: string;

  get groupName(): string {
    return this._groupName;
  }

  set groupName(value: string) {
    this._groupName = value;
  }

  private _colorCode: string;

  get colorCode(): string {
    return this._colorCode;
  }

  set colorCode(value: string) {
    this._colorCode = value;
  }

  private _responses: Array<IQuizResponse>;

  get responses(): Array<IQuizResponse> {
    return this._responses;
  }

  set responses(value: Array<IQuizResponse>) {
    this._responses = value;
  }

  private _casProfile: ICasData;

  get casProfile(): ICasData {
    return this._casProfile;
  }

  set casProfile(value: ICasData) {
    this._casProfile = value;
  }

  private _ticket: string;

  get ticket(): string {
    return this._ticket;
  }

  set ticket(value: string) {
    this._ticket = value;
  }

  constructor(data: IMemberSerialized) {
    super();

    this._id = new ObjectId(data.id || data._id);
    this._name = data.name;
    this._groupName = data.groupName;
    this._colorCode = data.colorCode || this.generateRandomColorCode();
    this._responses = data.responses || [];
    this._token = data.token;
    this._ticket = data.ticket;
    this._casProfile = CasDAO.match(data.ticket);
    this._currentQuizName = data.currentQuizName;

    if (!data.responses) {
      this._responses = this.generateResponseForQuiz(QuizDAO.getQuizByName(data.currentQuizName).questionList.length);
    }

    CasDAO.remove(data.ticket);
  }

  public serialize(): IMemberSerialized {
    return {
      id: this.id.toHexString(),
      name: this.name,
      groupName: this.groupName,
      colorCode: this.colorCode,
      responses: this.responses,
      token: this.token,
      currentQuizName: this.currentQuizName,
    };
  }

  public addResponseValue(data: Array<number> | string | number): void {
    const quiz = this.getCurrentQuiz();
    const responseTime = new Date().getTime() - quiz.currentStartTimestamp;

    this.responses[quiz.currentQuestionIndex].value = data;
    this.responses[quiz.currentQuestionIndex].responseTime = responseTime;
    DbDAO.updateOne(DbCollection.Members, {
      _id: this.id,
    }, { responses: this.responses });
    quiz.updatedMemberResponse({
      nickname: this.name,
      questionIndex: quiz.currentQuestionIndex,
      update: {
        value: data,
        responseTime,
      },
    });
  }

  public setConfidenceValue(confidence: number): void {
    const quiz = this.getCurrentQuiz();
    this.responses[quiz.currentQuestionIndex].confidence = confidence;
    DbDAO.updateOne(DbCollection.Members, {
      _id: this.id,
    }, { responses: this.responses });
    quiz.updatedMemberResponse({
      nickname: this.name,
      questionIndex: quiz.currentQuestionIndex,
      update: { confidence: confidence },
    });
  }

  public setReadingConfirmation(): void {
    const quiz = this.getCurrentQuiz();
    this.responses[quiz.currentQuestionIndex].readingConfirmation = true;
    DbDAO.updateOne(DbCollection.Members, {
      _id: this.id,
    }, { responses: this.responses });
    quiz.updatedMemberResponse({
      nickname: this.name,
      questionIndex: quiz.currentQuestionIndex,
      update: { readingConfirmation: true },
    });
  }

  public generateResponseForQuiz(questionAmount: number): Array<IQuizResponse> {
    const responses: Array<IQuizResponse> = [];
    for (let i = 0; i < questionAmount; i++) {
      responses[i] = {
        value: [],
        responseTime: -1,
        confidence: -1,
        readingConfirmation: false,
      };
    }
    return responses;
  }

  private getCurrentQuiz(): IQuizEntity {
    return QuizDAO.getQuizByName(this.currentQuizName);
  }

  private hashCode(str: string): number { // java String#hashCode
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  private intToRGB(i: number): string {
    const c: string = (i & 0x00FFFFFF)
    .toString(16)
    .toUpperCase();

    return '00000'.substring(0, 6 - c.length) + c;
  }

  private generateRandomColorCode(): string {
    return this.intToRGB(this.hashCode(this.name));
  }
}
