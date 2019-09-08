import { ObjectId } from 'bson';
import { IQuizResponse } from '../../quizzes/IQuizResponse';
import { ICasData } from '../../users/ICasData';
import { IMemberBase } from './IMemberBase';
import { IMemberSerialized } from './IMemberSerialized';

export interface IMemberEntity extends IMemberBase {
  id?: ObjectId;
  casProfile: ICasData;

  serialize(): IMemberSerialized;

  addResponseValue(data: Array<number>): void;

  setConfidenceValue(confidenceValue: number): void;

  setReadingConfirmation(): void;

  generateResponseForQuiz(questionAmount: number): Array<IQuizResponse>;
}
