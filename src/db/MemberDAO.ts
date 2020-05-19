import { ObjectId } from 'bson';
import * as cluster from 'cluster';
import * as CryptoJS from 'crypto-js';
import { EventEmitter } from 'events';
import { Document, Error } from 'mongoose';
import * as routeCache from 'route-cache';
import * as superagent from 'superagent';
import { HistoryModelType } from '../enums/HistoryModelType';
import { IPCExchange } from '../enums/IPCExchange';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { RoutingCache } from '../enums/RoutingCache';
import { IMemberSerialized } from '../interfaces/entities/Member/IMemberSerialized';
import { IQuizResponse } from '../interfaces/quizzes/IQuizResponse';
import { HistoryModel } from '../models/HistoryModel';
import { MemberModel, MemberModelItem } from '../models/member/MemberModel';
import { QuizModelItem } from '../models/quiz/QuizModelItem';
import { settings } from '../statistics';
import { AbstractDAO } from './AbstractDAO';
import AMQPConnector from './AMQPConnector';
import QuizDAO from './QuizDAO';
import Hex = require('crypto-js/enc-hex');

class MemberDAO extends AbstractDAO {
  public readonly totalUsersChanged = new EventEmitter();

  private _totalUsers = 0;

  set totalUsers(value: number) {
    this._totalUsers = value;
    this.totalUsersChanged.emit('update', this._totalUsers);
    routeCache.removeCache(RoutingCache.Statistics);
  }

  constructor() {
    super();
    if (process.env.NODE_ENV !== 'test' && cluster.isMaster) {
      this.initializeUserQuery();
    }
  }

  public static getInstance(): MemberDAO {
    if (!this.instance) {
      this.instance = new MemberDAO();
    }

    return this.instance;
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    const average = await HistoryModel.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$ref', '$name'] },
          rounds: { $push: { $cond: [{ $ifNull: ['$ref', null] }, '$$REMOVE', true] } },
          attendees: { $push: { $cond: [{ $ifNull: ['$ref', null] }, true, '$$REMOVE'] } },
        },
      },
      { $project: { roundsLength: { $size: '$rounds' }, attendeesLength: { $size: '$attendees' } } },
      { $project: { perRound: { $divide: ['$attendeesLength', '$roundsLength'] } } },
      { $match: { perRound: { $gt: 0 } } },
      { $group: { _id: null, avrg: { $avg: '$perRound' } } },
      { $project: { _id: 0, average: { $ceil: '$avrg' } } },
    ]).exec();

    return {
      total: this._totalUsers,
      active: await MemberModel.countDocuments({}),
      average: isNaN(average[0]?.average) ? 0 : average[0]?.average ?? 0,
    };
  }

  public getMemberByName(name: string): Promise<Document & MemberModelItem> {
    return MemberModel.findOne({ name }).exec();
  }

  public async addMember(memberSerialized: IMemberSerialized): Promise<Document & MemberModelItem> {
    if (memberSerialized.id && this.getMemberById(memberSerialized.id)) {
      throw new Error(`Duplicate member insertion: (name: ${memberSerialized.name}, id: ${memberSerialized.id})`);
    }

    memberSerialized.bonusToken = this.generateBonusToken(memberSerialized.currentQuizName, memberSerialized.name);
    memberSerialized.isActive = true;

    const doc = await MemberModel.create(memberSerialized);
    const docSerialized = doc.toJSON();
    delete docSerialized.token;
    delete docSerialized.ticket;
    delete docSerialized.casProfile;
    delete docSerialized.bonusToken;

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(memberSerialized.currentQuizName), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Added,
      payload: { member: docSerialized },
    })));

    AMQPConnector.sendRequestStatistics();

    HistoryModel.create({ type: HistoryModelType.Attendee, name: docSerialized.name, ref: docSerialized.currentQuizName });

    return doc;
  }

  public getMembersOfQuiz(quizName: string): Promise<Array<Document & MemberModelItem>> {
    return MemberModel.find({ currentQuizName: quizName }, {
      token: 0,
      ticket: 0,
      casProfile: 0,
      bonusToken: 0,
    }).exec();
  }

  public async isMemberInQuiz(member: IMemberSerialized, activeQuiz: Document & QuizModelItem): Promise<boolean> {
    return MemberModel.exists({ currentQuizName: activeQuiz.name, name: member.name });
  }

  public getMembersOfQuizForOwner(quizName: string): Promise<Array<Document & MemberModelItem>> {
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
    AMQPConnector.sendRequestStatistics();
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

  public async resetMembersOfQuiz(name: string, questionAmount: number): Promise<any> {
    await MemberModel.deleteMany({
      currentQuizName: name,
      isActive: false,
    }).exec();
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
    let responseTime;
    if (quiz.currentStartTimestamp > 0) {
      responseTime = new Date().getTime() - quiz.currentStartTimestamp;
    } else {
      responseTime = 0;
    }

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
      return typeof val === 'number' ? val > -1 : Array.isArray(val) ? val.length > 0 : (
        val !== null && typeof val !== 'undefined'
      );
    })) {
      process.send({ message: IPCExchange.QuizStop, data: quiz.name });
      await QuizDAO.stopQuiz(quiz);
    }
  }

  public async removeMemberByName(quizName: string, nickname: string): Promise<Document & MemberModelItem> {

    let doc;

    try {

      const member: MemberModelItem = await this.getMemberByName(nickname);

      if (member.responses && member.responses.every(response => !(
          Array.isArray(response.value) && response.value.length === 0
      ))) {
        doc = MemberModel.findOneAndUpdate({
          currentQuizName: quizName,
          name: nickname,
        }, {
          isActive: false,
        }).exec();
        AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quizName), '.*', Buffer.from(JSON.stringify({
          status: StatusProtocol.Success,
          step: MessageProtocol.Updated,
          payload: { name: nickname },
        })));
      } else {
        doc = MemberModel.findOneAndDelete({
          currentQuizName: quizName,
          name: nickname,
        }).exec();
        AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quizName), '.*', Buffer.from(JSON.stringify({
          status: StatusProtocol.Success,
          step: MessageProtocol.Removed,
          payload: { name: nickname },
        })));
      }
      AMQPConnector.sendRequestStatistics();
    } catch (err) {
    }

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


  private generateBonusToken(quizname, username): string {
    return Hex.stringify(CryptoJS.SHA256(quizname + username + Date.now()));
  }

  private initializeUserQuery(): void {
    setInterval(async () => {
      const reqOptions = {
        protocol: settings.amqp.managementApi.protocol,
        host: settings.amqp.managementApi.host,
        port: settings.amqp.managementApi.port,
        path: `/api/connections`,
        auth: `${settings.amqp.managementApi.user}:${settings.amqp.managementApi.password}`,
      };

      const totalUsersResponse = await superagent.get(reqOptions.protocol + '//' + reqOptions.host + ':' + reqOptions.port + reqOptions.path) //
        .set('Authorization', 'Basic ' + Buffer.from(reqOptions.auth).toString('base64'));

      const total = totalUsersResponse.body //
        .filter(val => val.client_properties.product === 'STOMP client') //
        .filter(val => val.vhost === settings.amqp.vhost) //
        .length; //

      if (this._totalUsers !== total) {
        this.totalUsers = total;
        AMQPConnector.sendRequestStatistics();
      }
    }, 10000);
  }
}

export default MemberDAO.getInstance();
