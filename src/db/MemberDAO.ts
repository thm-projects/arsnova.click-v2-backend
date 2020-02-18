import { ObjectId } from 'bson';
import { Document } from 'mongoose';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { IMemberSerialized } from '../interfaces/entities/Member/IMemberSerialized';
import { IQuizResponse } from '../interfaces/quizzes/IQuizResponse';
import { MemberModel, MemberModelItem } from '../models/member/MemberModel';
import { AbstractDAO } from './AbstractDAO';
import AMQPConnector from './AMQPConnector';
import QuizDAO from './QuizDAO';

class MemberDAO extends AbstractDAO {

  public static getInstance(): MemberDAO {
    if (!this.instance) {
      this.instance = new MemberDAO();
    }

    return this.instance;
  }

  public getMemberByName(name: string): Promise<Document & MemberModelItem> {
    return MemberModel.findOne({ name }).exec();
  }

  public async addMember(memberSerialized: IMemberSerialized): Promise<Document & MemberModelItem> {
    if (memberSerialized.id && this.getMemberById(memberSerialized.id)) {
      throw new Error(`Duplicate member insertion: (name: ${memberSerialized.name}, id: ${memberSerialized.id})`);
    }

    const doc = await MemberModel.create(memberSerialized);
    const docSerialized = doc.toJSON();
    delete docSerialized.token;
    delete docSerialized.ticket;
    delete docSerialized.casProfile;

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(memberSerialized.currentQuizName), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Added,
      payload: { member: docSerialized },
    })));

    return doc;
  }

  public getMembersOfQuiz(quizName: string): Promise<Array<Document & MemberModelItem>> {
    return MemberModel.find({ currentQuizName: quizName }, {
      token: 0,
      ticket: 0,
      casProfile: 0,
    }).exec();
  }

  public getMemberByToken(token: string): Promise<Document & MemberModelItem> {
    return MemberModel.findOne({ token }).exec();
  }

  public async removeMembersOfQuiz(quizName: string): Promise<void> {
    const members = await MemberModel.find({ currentQuizName: quizName }).exec();
    members.forEach(member => {
      AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(member.currentQuizName), '.*', Buffer.from(JSON.stringify({
        status: StatusProtocol.Success,
        step: MessageProtocol.Removed,
        payload: { name: member.name },
      })));
    });

    await MemberModel.deleteMany({ currentQuizName: quizName }).exec();
  }

  public async getMemberAmountPerQuizGroup(name: string, groups: Array<string>): Promise<object> {
    const result = {};
    groups.forEach(g => result[g] = 0);

    (
      await this.getMembersOfQuiz(name)
    ).forEach(member => {
      result[member.groupName]++;
    });

    return result;
  }

  public resetMembersOfQuiz(name: string, questionAmount: number): Promise<any> {
    return MemberModel.updateMany({ currentQuizName: name }, {
      responses: this.generateResponseForQuiz(questionAmount),
    }).exec();
  }

  public async setReadingConfirmation(member: Document & MemberModelItem): Promise<void> {
    const quiz = await QuizDAO.getQuizByName(member.currentQuizName);

    member.responses[quiz.currentQuestionIndex].readingConfirmation = true;

    const queryPath = `responses.${quiz.currentQuestionIndex}.readingConfirmation`;
    await MemberModel.updateOne({ _id: member._id }, { [queryPath]: true }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedResponse,
      payload: {
        nickname: member.name,
        questionIndex: quiz.currentQuestionIndex,
        update: { readingConfirmation: true },
      },
    })));
  }

  public async setConfidenceValue(member: Document & MemberModelItem, confidenceValue: number): Promise<void> {
    const quiz = await QuizDAO.getQuizByName(member.currentQuizName);

    member.responses[quiz.currentQuestionIndex].confidence = confidenceValue;

    const queryPath = `responses.${quiz.currentQuestionIndex}.confidence`;
    await MemberModel.updateOne({ _id: member._id }, { [queryPath]: confidenceValue }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedResponse,
      payload: {
        nickname: member.name,
        questionIndex: quiz.currentQuestionIndex,
        update: { confidence: confidenceValue },
      },
    })));
  }

  public async addResponseValue(member: Document & MemberModelItem, data: string | number | Array<number>): Promise<void> {
    const quiz = await QuizDAO.getQuizByName(member.currentQuizName);
    const responseTime = new Date().getTime() - quiz.currentStartTimestamp;

    member.responses[quiz.currentQuestionIndex].value = data;

    const queryPathValue = `responses.${quiz.currentQuestionIndex}.value`;
    const queryPathResponseTime = `responses.${quiz.currentQuestionIndex}.responseTime`;
    await MemberModel.updateOne({ _id: member._id }, {
      [queryPathValue]: data,
      [queryPathResponseTime]: responseTime,
    }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedResponse,
      payload: {
        nickname: member.name,
        questionIndex: quiz.currentQuestionIndex,
        update: {
          value: data,
          responseTime,
        },
      },
    })));

    if ((
      await this.getMembersOfQuiz(quiz.name)
    ).every(nick => {
      const val = nick.responses[quiz.currentQuestionIndex].value;
      return typeof val === 'number' ? val > -1 : val.length > 0;
    })) {
      await QuizDAO.stopQuiz(quiz);
    }
  }

  public removeMemberByName(quizName: string, nickname: string): Promise<Document & MemberModelItem> {
    const doc = MemberModel.findOneAndRemove({
      currentQuizName: quizName,
      name: nickname,
    }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quizName), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Removed,
      payload: { name: nickname },
    })));

    return doc;
  }

  public getMembers(): Promise<Array<Document & MemberModelItem>> {
    return MemberModel.find().exec();
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

  private getMemberById(id: ObjectId | string): Promise<Document & MemberModelItem> {
    return MemberModel.findById(id).exec();
  }
}

export default MemberDAO.getInstance();
