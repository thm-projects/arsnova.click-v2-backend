import { ObjectId } from 'bson';
import { DeleteWriteOpResultObject } from 'mongodb';
import * as WebSocket from 'ws';
import DbDAO from '../../db/DbDAO';
import MemberDAO from '../../db/MemberDAO';
import { DbCollection, DbEvent } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuestionType } from '../../enums/QuestionType';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuizEntity, IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { ISessionConfigurationEntity } from '../../interfaces/session_configuration/ISessionConfigurationEntity';
import { SendSocketMessageService } from '../../services/SendSocketMessageService';
import { AbstractEntity } from '../AbstractEntity';
import { MemberEntity } from '../member/MemberEntity';
import { MemberGroupEntity } from '../member/MemberGroupEntity';
import { AbstractQuestionEntity } from '../question/AbstractQuestionEntity';
import { getQuestionForType } from '../question/QuizValidator';
import { SessionConfigurationEntity } from '../session-configuration/SessionConfigurationEntity';

export class QuizEntity extends AbstractEntity implements IQuizEntity {
  private _readingConfirmationRequested: boolean;

  get readingConfirmationRequested(): boolean {
    return this._readingConfirmationRequested;
  }

  set readingConfirmationRequested(value: boolean) {
    this._readingConfirmationRequested = value;
  }

  private _name: string;

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  private _currentQuestionIndex: number;

  get currentQuestionIndex(): number {
    return this._currentQuestionIndex;
  }

  set currentQuestionIndex(value: number) {
    this._currentQuestionIndex = value;
  }

  private _questionList: Array<AbstractQuestionEntity>;

  get questionList(): Array<AbstractQuestionEntity> {
    return this._questionList;
  }

  set questionList(value: Array<AbstractQuestionEntity>) {
    this._questionList = value;
  }

  private _sessionConfig: ISessionConfigurationEntity;

  get sessionConfig(): ISessionConfigurationEntity {
    return this._sessionConfig;
  }

  set sessionConfig(value: ISessionConfigurationEntity) {
    this._sessionConfig = value;
  }

  private _state: QuizState;

  get state(): QuizState {
    return this._state;
  }

  set state(value: QuizState) {
    this._state = value;
  }

  private _expiry: Date;

  get expiry(): Date {
    return this._expiry;
  }

  set expiry(value: Date) {
    this._expiry = value;
  }

  private _currentStartTimestamp: number;

  get currentStartTimestamp(): number {
    return this._currentStartTimestamp;
  }

  set currentStartTimestamp(value: number) {
    this._currentStartTimestamp = value;
  }

  private _memberGroups: Array<MemberGroupEntity>;

  get memberGroups(): Array<MemberGroupEntity> {
    return this._memberGroups;
  }

  set memberGroups(value: Array<MemberGroupEntity>) {
    this._memberGroups = value;
  }

  private _adminToken: string;

  get adminToken(): string {
    return this._adminToken;
  }

  set adminToken(value: string) {
    this._adminToken = value;
  }

  private _privateKey: string;

  get privateKey(): string {
    return this._privateKey;
  }

  set privateKey(value: string) {
    this._privateKey = value;
  }

  private _visibility: QuizVisibility;

  get visibility(): QuizVisibility {
    return this._visibility;
  }

  set visibility(value: QuizVisibility) {
    this._visibility = value;
  }

  private _description: string;

  get description(): string {
    return this._description;
  }

  set description(value: string) {
    this._description = value;
  }

  private _socketChannel: Array<WebSocket> = [];

  constructor(quiz: IQuizSerialized) {
    super();

    this._id = new ObjectId(quiz._id || quiz.id);
    this._name = quiz.name;
    this._questionList = (quiz.questionList || []).map(val => getQuestionForType(val.TYPE, val));
    this._sessionConfig = quiz.sessionConfig ? new SessionConfigurationEntity(quiz.sessionConfig) : null;
    this._expiry = quiz.expiry;
    this._state = quiz.state || QuizState.Inactive;
    this._currentStartTimestamp = quiz.currentStartTimestamp || -1;
    this._currentQuestionIndex = typeof quiz.currentQuestionIndex !== 'undefined' ? quiz.currentQuestionIndex : -1;
    this._adminToken = quiz.adminToken;
    this._privateKey = quiz.privateKey;
    this._readingConfirmationRequested = !!quiz.readingConfirmationRequested;
    this._visibility = quiz.visibility;
    this._description = quiz.description;

    if (!quiz.memberGroups) {
      if (quiz.sessionConfig && quiz.sessionConfig.nicks && quiz.sessionConfig.nicks.memberGroups) {
        quiz.memberGroups = quiz.sessionConfig.nicks.memberGroups.map(group => ({ name: group }));
      } else {
        quiz.memberGroups = [];
      }
    }

    this._memberGroups = quiz.memberGroups.map(val => new MemberGroupEntity(val));

    MemberDAO.updateEmitter.on(DbEvent.Create, (member: MemberEntity) => {
      if (member.currentQuizName !== this.name) {
        return;
      }

      this.memberGroups.find(group => group.name === member.groupName).members.push(member);
      this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
        status: StatusProtocol.Success,
        step: MessageProtocol.Added,
        payload: { member: member.serialize() },
      }));
    });
    MemberDAO.updateEmitter.on(DbEvent.Delete, (member: MemberEntity) => {
      if (member.currentQuizName !== this.name) {
        return;
      }

      const memberGroup = this.memberGroups.find(group => group.name === member.groupName);
      memberGroup.members.splice(memberGroup.members.findIndex(quizMembers => quizMembers.name === member.name), 1);

      this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
        status: StatusProtocol.Success,
        step: MessageProtocol.Removed,
        payload: { name: member.name },
      }));
    });
  }

  public onRemove(): void {
    this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
      status: StatusProtocol.Success,
      step: MessageProtocol.Closed,
    }));
  }

  public reset(): void {
    this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
      status: StatusProtocol.Success,
      step: MessageProtocol.Reset,
    }));
  }

  public addSocketToChannel(socket: WebSocket): void {
    if (this._socketChannel.find(value => value === socket)) {
      return;
    }

    socket.on('close', () => {
      this.removeSocketFromChannel(socket);
    });

    this._socketChannel.push(socket);
  }

  public removeSocketFromChannel(socket: WebSocket): void {
    const index = this._socketChannel.findIndex(value => value === socket);
    this._socketChannel.splice(index, 1);
  }

  public containsSocket(socket: WebSocket): boolean {
    return !!this._socketChannel.find(value => value === socket);
  }

  public addQuestion(question: AbstractQuestionEntity, index: number = -1): void {
    if (index === -1 || index >= this.questionList.length) {
      this.questionList.push(question);
    } else {
      this.questionList.splice(index, 0, question);
    }
  }

  public removeQuestion(index: number): void {
    if (index < 0 || index > this.questionList.length) {
      throw new Error('Invalid argument list for QuestionGroup.removeQuestion');
    }
    this._questionList.splice(index, 1);
  }

  public serialize(): IQuizSerialized {
    return {
      id: this.id.toHexString(),
      name: this.name,
      questionList: this.questionList.map((question: AbstractQuestionEntity) => question.serialize()),
      sessionConfig: this.sessionConfig.serialize(),
      expiry: this.expiry,
      state: this.state,
      currentStartTimestamp: this.currentStartTimestamp,
      memberGroups: this.memberGroups.map(val => val.serialize()),
      currentQuestionIndex: this.currentQuestionIndex,
      adminToken: this.adminToken,
      privateKey: this.privateKey,
      readingConfirmationRequested: this.readingConfirmationRequested,
      visibility: this.visibility,
      description: this.description,
    };
  }

  public isValid(): boolean {
    let questionListValid = this.questionList.length > 0;
    this.questionList.forEach((question: AbstractQuestionEntity) => {
      if (questionListValid && !question.isValid()) {
        questionListValid = false;
      }
    });
    return questionListValid;
  }

  public addDefaultQuestion(index: number = -1, type: QuestionType.SingleChoiceQuestion): void {
    if (typeof index === 'undefined' || index === -1 || index >= this.questionList.length) {
      index = this.questionList.length;
    }
    const questionItem = getQuestionForType(type, {
      hashtag: this.name,
      questionText: '',
      questionIndex: index,
      timer: 40,
      startTime: 0,
      answerOptionList: [],
    });
    this.addQuestion(questionItem, index);
  }

  public nextQuestion(): number {
    const nextIndex = this._currentQuestionIndex + 1;
    if (nextIndex > this.questionList.length) {
      return -1;
    }
    this._currentQuestionIndex = nextIndex;

    DbDAO.update(DbCollection.Quizzes, { _id: this.id }, { currentQuestionIndex: nextIndex });

    this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
      status: StatusProtocol.Success,
      step: MessageProtocol.NextQuestion,
      payload: {
        quiz: this.serialize(),
        nextQuestionIndex: nextIndex,
      },
    }));

    return nextIndex;
  }

  public removeMember(name: string): Promise<DeleteWriteOpResultObject> {
    return DbDAO.deleteOne(DbCollection.Members, { name });
  }

  public startNextQuestion(currentStartTimestamp: number): void {
    this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
      status: StatusProtocol.Success,
      step: MessageProtocol.Start,
      payload: {
        currentStartTimestamp,
      },
    }));
  }

  public requestReadingConfirmation(): void {
    this._readingConfirmationRequested = true;
    this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
      status: StatusProtocol.Success,
      step: MessageProtocol.ReadingConfirmationRequested,
      payload: {},
    }));
  }

  public updatedMemberResponse(payload: object): void {
    this._socketChannel.forEach(socket => SendSocketMessageService.sendMessage(socket, {
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedResponse,
      payload,
    }));
  }
}
