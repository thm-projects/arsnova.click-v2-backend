import {
  IActiveQuiz, IActiveQuizSerialized, ICasData, IMemberGroup, IMemberGroupSerialized, INickname, INicknameSerialized, IQuizResponse,
} from 'arsnova-click-v2-types/dist/common';
import { COMMUNICATION_PROTOCOL, COMMUNICATION_PROTOCOL_LOBBY } from 'arsnova-click-v2-types/dist/communication_protocol';
import { IQuestionGroup } from 'arsnova-click-v2-types/dist/questions/interfaces';
import * as WebSocket from 'ws';
import CasDAO from '../db/CasDAO';
import QuizManagerDAO from '../db/QuizManagerDAO';
import illegalNicks from '../nicknames/illegalNicks';
import { WebSocketRouter } from '../routes/websocket';

export class MemberGroup implements IMemberGroup {
  get members(): Array<INickname> {
    return this._members;
  }

  get name(): string {
    return this._name;
  }

  private readonly _name: string;
  private readonly _members: Array<INickname>;

  constructor(name, members = []) {
    this._name = name;
    this._members = members;
  }

  public serialize(): IMemberGroupSerialized {
    return {
      name: this.name,
      members: this.members.map(nick => nick.serialize()),
    };
  }
}

export class Member implements INickname {
  get groupName(): string {
    return this._groupName;
  }

  get casProfile(): ICasData {
    return this._casProfile;
  }

  get responses(): Array<IQuizResponse> {
    return this._responses;
  }

  get id(): number {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get colorCode(): string {
    return this._colorCode;
  }

  private _webSocket: WebSocket;

  get webSocket(): WebSocket {
    return this._webSocket;
  }

  set webSocket(value: WebSocket) {
    this._webSocket = value;
  }

  private _webSocketAuthorization: number;

  get webSocketAuthorization(): number {
    return this._webSocketAuthorization;
  }

  set webSocketAuthorization(value: number) {
    this._webSocketAuthorization = value;
  }

  private readonly _id: number;
  private readonly _name: string;
  private readonly _groupName: string;
  private readonly _colorCode: string;
  private readonly _responses: Array<IQuizResponse>;
  private readonly _casProfile: ICasData;

  constructor({ id, name, colorCode, responses, groupName, webSocketAuthorization, ticket }: {
    id: number, name: string, colorCode?: string, responses?: Array<IQuizResponse>, groupName: string, webSocketAuthorization: number, ticket: string
  }) {
    this._id = id;
    this._name = name;
    this._groupName = groupName;
    this._colorCode = colorCode || this.generateRandomColorCode();
    this._responses = responses || [];
    this._webSocketAuthorization = webSocketAuthorization;
    this._casProfile = CasDAO.match(ticket);
    CasDAO.remove(ticket);
  }

  public serialize(): INicknameSerialized {
    return {
      id: this.id,
      name: this.name,
      groupName: this.groupName,
      colorCode: this.colorCode,
      responses: this.responses,
    };
  }

  private hashCode(str: string): number { // java String#hashCode
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + (
        (
          hash << 5
        ) - hash
      );
    }
    return hash;
  }

  private intToRGB(i: number): string {
    const c: string = (
      i & 0x00FFFFFF
    )
    .toString(16)
    .toUpperCase();

    return '00000'.substring(0, 6 - c.length) + c;
  }

  private generateRandomColorCode(): string {
    return this.intToRGB(this.hashCode(this.name));
  }
}

export class ActiveQuizItem implements IActiveQuiz {
  get memberGroups(): Array<IMemberGroup> {
    return this._memberGroups;
  }

  get originalObject(): IQuestionGroup {
    return this._originalObject;
  }

  get name(): string {
    return this._name;
  }

  private _currentQuestionIndex: number;

  get currentQuestionIndex(): number {
    return this._currentQuestionIndex;
  }

  set currentQuestionIndex(value: number) {
    this._currentQuestionIndex = value;
  }

  private _currentStartTimestamp = 0;

  get currentStartTimestamp(): number {
    return this._currentStartTimestamp;
  }

  private _ownerSocket: WebSocket;

  get ownerSocket(): WebSocket {
    return this._ownerSocket;
  }

  set ownerSocket(value: WebSocket) {
    this._ownerSocket = value;
  }

  private readonly _name: string;
  private readonly _memberGroups: Array<IMemberGroup>;
  private readonly _originalObject: IQuestionGroup;
  private _countdownInterval: any;

  constructor({ memberGroups, originalObject, currentQuestionIndex }) {
    this._name = originalObject.hashtag;
    this._memberGroups = memberGroups;
    this._originalObject = originalObject;
    this._currentQuestionIndex = typeof currentQuestionIndex !== 'undefined' ? currentQuestionIndex : -1;
  }

  public serialize(): IActiveQuizSerialized {
    return {
      memberGroups: this.memberGroups.map(memberGroup => {
        return memberGroup.serialize();
      }),
      originalObject: this._originalObject,
      currentQuestionIndex: this._currentQuestionIndex,
    };
  }

  public onDestroy(): void {
    const messageToAllWSSClients = JSON.stringify({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.SET_INACTIVE,
      payload: {
        quizName: this.name,
      },
    });
    WebSocketRouter.wss.clients.forEach(client => client.send(messageToAllWSSClients));

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.CLOSED,
      payload: {},
    });
  }

  public requestReadingConfirmation(): void {
    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.READING_CONFIRMATION_REQUESTED,
      payload: {},
    });
  }

  public reset(): void {
    this._currentQuestionIndex = -1;
    this._currentStartTimestamp = 0;
    this.memberGroups.forEach(memberGroup => {
      memberGroup.members.forEach(member => {
        member.responses.splice(0, member.responses.length);
      });
    });
    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.RESET,
      payload: {},
    });
    QuizManagerDAO.quizStatusUpdated();
  }

  public setTimestamp(startTimestamp: number): void {
    this._currentStartTimestamp = startTimestamp;

    let timer = this.originalObject.questionList[this.currentQuestionIndex].timer;
    this._countdownInterval = setInterval(() => {
      if (!timer || this.memberGroups.filter(memberGroup => {
        return memberGroup.members.filter(nick => {
          if (!nick.responses[this.currentQuestionIndex]) {
            return false;
          }
          const value = nick.responses[this.currentQuestionIndex].value;
          return typeof value === 'number' ? !isNaN(value) : value.length;
        }).length === memberGroup.members.length;
      }).length === this.memberGroups.length) {
        clearInterval(this._countdownInterval);
        this._currentStartTimestamp = 0;
      } else {
        timer--;
      }
    }, 1000);

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.START,
      payload: { startTimestamp },
    });
  }

  public stop(): void {
    clearInterval(this._countdownInterval);
    this._currentStartTimestamp = 0;

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.STOP,
      payload: {},
    });
  }

  public nextQuestion(): number {
    if (this.currentQuestionIndex >= this.originalObject.questionList.length - 1) {
      return -1;
    }

    this.currentQuestionIndex++;

    if (this.currentQuestionIndex === 0) {
      QuizManagerDAO.quizStatusUpdated();
    }

    this.memberGroups.forEach(memberGroup => memberGroup.members.forEach(member => {
      member.responses.push({
        value: [],
        responseTime: 0,
        confidence: 0,
        readingConfirmation: false,
      });
    }));

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.NEXT_QUESTION,
      payload: {
        questionIndex: this.currentQuestionIndex,
      },
    });

    return this.currentQuestionIndex;
  }

  public findMemberByName(name: string): INickname {
    return this.memberGroups.reduce((previousValue, currentValue) => {
      return [...previousValue, ...currentValue.members];
    }, []).find(nickname => nickname.name === name);
  }

  public addMember(name: string, webSocketAuthorization: number, groupName: string = 'Default', ticket?: string): boolean {
    const foundMembers = this.findMemberByName(name);
    const group: IMemberGroup = this.memberGroups.find(memberGroup => memberGroup.name === groupName);

    if (foundMembers) {
      throw new Error(COMMUNICATION_PROTOCOL_LOBBY[COMMUNICATION_PROTOCOL.LOBBY.DUPLICATE_LOGIN]);
    }
    if (!group) {
      throw new Error(COMMUNICATION_PROTOCOL_LOBBY[COMMUNICATION_PROTOCOL.LOBBY.UNKNOWN_GROUP]);
    }
    if (this.originalObject.sessionConfig.nicks.blockIllegalNicks && illegalNicks.indexOf(name.toUpperCase()) > -1) {
      throw new Error(COMMUNICATION_PROTOCOL_LOBBY[COMMUNICATION_PROTOCOL.LOBBY.ILLEGAL_NAME]);
    }
    if (this.originalObject.sessionConfig.nicks.restrictToCasLogin && !ticket) {
      throw new Error(COMMUNICATION_PROTOCOL_LOBBY[COMMUNICATION_PROTOCOL.LOBBY.CAS_LOGIN_REQUIRED]);
    }

    const addedMember: INickname = new Member({
      id: group.members.length,
      name,
      groupName,
      webSocketAuthorization,
      ticket,
    });
    this.memberGroups.find(memberGroup => memberGroup.name === groupName).members.push(addedMember);
    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.ADDED,
      payload: { member: addedMember.serialize() },
    });
    return true;
  }

  public removeMember(name: string): boolean {
    const foundMembers = this.findMemberByName(name);

    if (!foundMembers) {
      return false;
    }

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.REMOVED,
      payload: {
        name: name,
      },
    });

    /* Must be beneath the pushMessageToClients call so that the target member will receive the kick notification */
    this.memberGroups.forEach(memberGroup => {
      if (memberGroup.name === foundMembers.groupName) {
        memberGroup.members.splice(memberGroup.members.indexOf(foundMembers), 1);
      }
    });
    return true;
  }

  public addResponseValue(nickname: string, data: Array<number>): void {
    this.findMemberByName(nickname).responses[this.currentQuestionIndex].responseTime = (
      (
        new Date().getTime() - this._currentStartTimestamp
      ) / 1000
    );
    this.findMemberByName(nickname).responses[this.currentQuestionIndex].value = data;

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.UPDATED_RESPONSE,
      payload: {
        nickname: this.findMemberByName(nickname).serialize(),
      },
    });
  }

  public setConfidenceValue(nickname: string, confidenceValue: number): void {
    this.findMemberByName(nickname).responses[this.currentQuestionIndex].confidence = confidenceValue;

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.UPDATED_RESPONSE,
      payload: {
        nickname: this.findMemberByName(nickname).serialize(),
      },
    });
  }

  public setReadingConfirmation(nickname: string): void {
    this.findMemberByName(nickname).responses[this.currentQuestionIndex].readingConfirmation = true;

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.UPDATED_RESPONSE,
      payload: {
        nickname: this.findMemberByName(nickname).serialize(),
      },
    });
  }

  public updateQuizSettings(target: string, state: boolean): void {
    this.originalObject.sessionConfig[target] = state;

    this.pushMessageToClients({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.UPDATED_SETTINGS,
      payload: {
        target,
        state,
      },
    });
  }

  private pushMessageToClients(message: any): void {
    this.memberGroups.forEach(memberGroup => {
      memberGroup.members.forEach(value => {
        if (value.webSocket && value.webSocket.readyState === WebSocket.OPEN) {
          value.webSocket.send(JSON.stringify(message));
        } else if (value.webSocket) {
        } else {
        }
      });
    });
    if (this._ownerSocket && this._ownerSocket.readyState === WebSocket.OPEN) {
      this._ownerSocket.send(JSON.stringify(message));
    } else if (this._ownerSocket) {
    } else {
    }
  }
}

export class ActiveQuizItemPlaceholder implements IActiveQuiz {
  public name: string;
  public memberGroups: Array<IMemberGroup>;
  // noinspection JSUnusedGlobalSymbols
  public currentQuestionIndex: number;
  public originalObject: IQuestionGroup;
  // noinspection JSUnusedGlobalSymbols
  public currentStartTimestamp: number;
  public webSocketAuthorization: number;
  // noinspection JSUnusedGlobalSymbols
  public ownerSocket: WebSocket;

  constructor(name: string) {
    this.name = name;
  }

  public serialize(): IActiveQuizSerialized {
    throw new Error('Method not implemented.');
  }

  public requestReadingConfirmation(): void {
    throw new Error('Method not implemented.');
  }

  public setConfidenceValue(nickname: string, confidenceValue: number): void {
    throw new Error('Method not implemented.');
  }

  public setReadingConfirmation(nickname: string): void {
    throw new Error('Method not implemented.');
  }

  public addMember(name: string, webSocketAuthorization: number): boolean {
    throw new Error('Method not implemented.');
  }

  public removeMember(name: string): boolean {
    throw new Error('Method not implemented.');
  }

  public addResponseValue(nickname: string, data: Array<number>): void {
    throw new Error('Method not implemented.');
  }

  public nextQuestion(): number {
    throw new Error('Method not implemented.');
  }

  public setTimestamp(startTimestamp: number): void {
    throw new Error('Method not implemented.');
  }

  public stop(): void {
    throw new Error('Method not implemented.');
  }

  public reset(): void {
    throw new Error('Method not implemented.');
  }

  public onDestroy(): void {
    throw new Error('Method not implemented.');
  }

  public updateQuizSettings(target: string, state: boolean): void {
    throw new Error('Method not implemented.');
  }
}
