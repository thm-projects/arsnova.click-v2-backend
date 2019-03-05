import { ObjectId } from 'bson';
import { DeleteWriteOpResultObject } from 'mongodb';
import WebSocket from 'ws';
import { AbstractQuestionEntity } from '../../entities/question/AbstractQuestionEntity';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuestionSerialized } from '../questions/IQuestion';
import { ISessionConfigurationEntity } from '../session_configuration/ISessionConfigurationEntity';
import { ISessionConfigurationSerialized } from '../session_configuration/ISessionConfigurationSerialized';

export interface IQuizEntity extends IQuizBase {
  id?: ObjectId;
  sessionConfig: ISessionConfigurationEntity;
  questionList: Array<AbstractQuestionEntity>;

  serialize(): IQuizSerialized;

  removeMember(name: string): Promise<DeleteWriteOpResultObject>;

  requestReadingConfirmation(): void;

  nextQuestion(): number;

  addDefaultQuestion(index: number, type: string): void;

  isValid(): boolean;

  removeQuestion(index: number): void;

  addQuestion(question: AbstractQuestionEntity, index: number): void;

  addSocketToChannel(socket: WebSocket): void;

  removeSocketFromChannel(socket: WebSocket): void;

  containsSocket(socket: WebSocket): boolean;

  updatedMemberResponse(payload: object): void;

  startNextQuestion(): void;

  reset(): void;

  stop(): void;

  onRemove(): void;
}

export interface IQuizSerialized extends IQuizBase {
  _id?: string;
  id?: string;
  sessionConfig: ISessionConfigurationSerialized;
  questionList: Array<IQuestionSerialized>;
}

export interface IQuizBase {
  readingConfirmationRequested: boolean;
  name: string;
  currentQuestionIndex?: number;
  expiry?: Date;
  state?: QuizState;
  currentStartTimestamp?: number;
  privateKey: string;
  visibility?: QuizVisibility;
  description?: string;
}
