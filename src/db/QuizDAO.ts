import { ObjectId } from 'bson';
import * as http from 'http';
import { Document } from 'mongoose';
import * as superagent from 'superagent';
import { HistoryModelType } from '../enums/HistoryModelType';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { QuizState } from '../enums/QuizState';
import { QuizVisibility } from '../enums/QuizVisibility';
import { IQuiz } from '../interfaces/quizzes/IQuizEntity';
import { generateToken } from '../lib/generateToken';
import { HistoryModel } from '../models/HistoryModel';
import { QuizModel, QuizModelItem } from '../models/quiz/QuizModelItem';
import { settings } from '../statistics';
import { AbstractDAO } from './AbstractDAO';
import AMQPConnector from './AMQPConnector';
import MemberDAO from './MemberDAO';

interface IQuizDAOStorage {
  quizTimer: number;
  quizTimerInterval: any;
  emptyQuizInterval: any;
  isEmpty: boolean;
}

class QuizDAO extends AbstractDAO {
  private readonly _storage: { [key: string]: IQuizDAOStorage };
  private readonly CHECK_STATE_INTERVAL = 90000; // 1.5 Minutes

  constructor(storage) {
    super();
    this._storage = storage;

    this.restoreActiveQuizTimers();
  }

  public static getInstance(): QuizDAO {
    if (!this.instance) {
      this.instance = new QuizDAO({});
    }

    return this.instance;
  }

  public async restoreActiveQuizTimers(): Promise<void> {
    const activeQuizzes = await QuizModel.find({ state: { $in: [QuizState.Active, QuizState.Finished, QuizState.Running] } }).exec();
    activeQuizzes.forEach(quiz => {
      this.initTimerData(quiz.name);
      this._storage[quiz.name].emptyQuizInterval = setInterval(() => {
        this.checkExistingConnection(quiz.name, quiz.privateKey);
      }, this.CHECK_STATE_INTERVAL);
    });
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    return {
      total: await QuizModel.countDocuments({}),
      active: await QuizModel.countDocuments({ state: { $in: [QuizState.Active, QuizState.Finished, QuizState.Running] } }),
    };
  }

  public getInactiveQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return this.getQuizByState([QuizState.Inactive]);
  }

  public getActiveQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return this.getQuizByState([QuizState.Active, QuizState.Finished, QuizState.Running]);
  }

  public getJoinableQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return this.getQuizByState([QuizState.Active]);
  }

  public async getRenameRecommendations(quizName: string): Promise<Array<string>> {
    const result = [];
    if (!quizName) {
      return result;
    }

    const count = await QuizModel.find({ name: new RegExp(`^${quizName.trim()}\\s?[0-9]*$`, 'i') }).countDocuments().exec();
    const date = new Date();
    const dateYearPart = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;
    const dateFormatted = `${dateYearPart}-${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    result.push(`${quizName} ${count + 1}`);
    result.push(`${quizName} ${dateFormatted}`);
    result.push(`${quizName} ${generateToken(quizName, new Date().getTime()).substr(0, 10)}`);
    return result;
  }

  public async getLastPersistedDemoQuizNumber(): Promise<number> {
    const quizzes = await QuizModel.find({ name: { $regex: new RegExp(`^(demo quiz) ([0-9]*)$`, 'i') } }).sort({
      name: -1,
    }).limit(1).collation({
      locale: 'en_US',
      numericOrdering: true,
    }).exec();
    if (!quizzes.length) {
      return 0;
    }

    const splitted = quizzes[0].name.split(' ');
    return parseInt(splitted[2], 10);
  }

  public async getLastPersistedAbcdQuizNumberByLength(length: number): Promise<number> {
    const regexMatchString = new Array(length).fill('').map((val, index) => `${String.fromCharCode(65 + index)}{1}`).join('');
    const quizzes = await QuizModel.find({ name: { $regex: new RegExp(`^(${regexMatchString}) ([0-9]*)$`, 'i') } }).sort({
      name: -1,
    }).limit(1).collation({
      locale: 'en_US',
      numericOrdering: true,
    }).exec();
    if (!quizzes.length) {
      return 0;
    }

    const splitted = quizzes[0].name.split(' ');
    return parseInt(splitted[1], 10);
  }

  public async convertLegacyQuiz(legacyQuiz: any): Promise<Document & QuizModelItem> {
    const name = legacyQuiz.hashtag;
    legacyQuiz = this.replaceTypeInformationOnLegacyQuiz(legacyQuiz);

    if (name) {
      if (await this.getQuizByName(name)) {
        const renameRecommendations = await this.getRenameRecommendations(name);
        legacyQuiz.name = renameRecommendations[0];
      } else {
        legacyQuiz.name = name;
      }
    }

    if (legacyQuiz.hasOwnProperty('configuration')) {

      // Detected old v1 arsnova.click quiz
      legacyQuiz.currentQuestionIndex = 0;
      legacyQuiz.expiry = null;
      legacyQuiz.currentStartTimestamp = -1;
      legacyQuiz.readingConfirmationRequested = false;

      legacyQuiz.sessionConfig = {
        music: {
          titleConfig: {
            lobby: legacyQuiz.configuration.music.lobbyTitle,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningTitle,
            countdownEnd: legacyQuiz.configuration.music.countdownEndTitle,
          },
          volumeConfig: {
            global: legacyQuiz.configuration.music.lobbyVolume,
            lobby: legacyQuiz.configuration.music.lobbyVolume,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningVolume,
            countdownEnd: legacyQuiz.configuration.music.countdownEndVolume,
            useGlobalVolume: legacyQuiz.configuration.music.isUsingGlobalVolume,
          },
          enabled: {
            lobby: legacyQuiz.configuration.music.lobbyEnabled,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningEnabled,
            countdownEnd: legacyQuiz.configuration.music.countdownEndEnabled,
          },
        },
        nicks: {
          selectedNicks: legacyQuiz.configuration.nicks.selectedValues,
          blockIllegalNicks: legacyQuiz.configuration.nicks.blockIllegal,
          restrictToCasLogin: legacyQuiz.configuration.nicks.restrictToCASLogin,
          memberGroups: ['Default'],
        },
        theme: legacyQuiz.configuration.theme,
        readingConfirmationEnabled: legacyQuiz.configuration.readingConfirmationEnabled,
        showResponseProgress: legacyQuiz.configuration.showResponseProgress,
        confidenceSliderEnabled: legacyQuiz.configuration.confidenceSliderEnabled,
      };
      delete legacyQuiz.configuration;
    }

    return legacyQuiz;
  }

  public async addQuiz(quizDoc: IQuiz): Promise<Document & QuizModelItem> {
    await AMQPConnector.channel.assertExchange(AMQPConnector.buildQuizExchange(quizDoc.name), 'fanout');
    delete quizDoc._id;
    delete quizDoc.id;
    const result = QuizModel.create(quizDoc);
    AMQPConnector.sendRequestStatistics();
    return result;
  }

  public updateQuiz(id: ObjectId, updatedFields: any): Promise<void> {
    return QuizModel.updateOne({ _id: new ObjectId(id) }, updatedFields).exec();
  }

  public getQuizByName(name: string): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({ name: this.buildQuiznameQuery(name) }).exec();
  }

  public getQuizForAttendee(quizName: string): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({ name: this.buildQuiznameQuery(quizName) }, {
      _id: 0,
      privateKey: 0,
      visibility: 0,
      expiry: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    }).exec();
  }

  public getExpiryQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ expiry: { $gte: new Date() } }).exec();
  }

  public async initQuiz(quiz: Document & QuizModelItem): Promise<void> {
    this.initTimerData(quiz.name);
    quiz.state = QuizState.Active;
    await this.updateQuiz(new ObjectId(quiz._id), quiz);

    this._storage[quiz.name].emptyQuizInterval = setInterval(() => {
      this.checkExistingConnection(quiz.name, quiz.privateKey);
    }, this.CHECK_STATE_INTERVAL);

    HistoryModel.create({ type: HistoryModelType.PlayedQuiz, name: quiz.name });
  }

  public getAllQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find().exec();
  }

  public isActiveQuiz(quizName: string): Promise<boolean> {
    return QuizModel.exists({
      name: this.buildQuiznameQuery(quizName),
      state: { $in: [QuizState.Active, QuizState.Running, QuizState.Finished] },
    });
  }

  public async setQuizAsInactive(quizName: string, privateKey: string): Promise<void> {
    await QuizModel.updateOne({
      name: this.buildQuiznameQuery(quizName),
      privateKey,
    }, {
      state: QuizState.Inactive,
      currentQuestionIndex: -1,
      currentStartTimestamp: -1,
      readingConfirmationRequested: false,
    }).exec();

    if (!this._storage[quizName]) {
      this.initTimerData(quizName);
    } else {
      clearInterval(this._storage[quizName].emptyQuizInterval);
    }

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetInactive,
      payload: {
        quizName,
      },
    })));

    AMQPConnector.sendRequestStatistics();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quizName), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Closed,
    })));

    await MemberDAO.removeMembersOfQuiz(quizName);
  }

  public getActiveQuizByName(quizName: string): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({
      name: this.buildQuiznameQuery(quizName),
      state: { $in: [QuizState.Active, QuizState.Running, QuizState.Finished] },
    }).exec();
  }

  public getAllPublicQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({
      visibility: QuizVisibility.Any,
      expiry: { $gte: new Date() },
    }).exec();
  }

  public getPublicQuizByName(quizName: string): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({
      name: this.buildQuiznameQuery(quizName),
      visibility: QuizVisibility.Any,
      expiry: { $gte: new Date() },
    }).exec();
  }

  public async getRenameAsToken(name: string): Promise<string> {
    let token;
    do {
      token = generateToken(name, new Date().getTime()).substr(0, 10);
    } while (await this.getQuizByName(token));
    return token;
  }

  public async removeQuizByName(quizName: string): Promise<void> {
    await QuizModel.deleteOne({ name: this.buildQuiznameQuery(quizName) }).exec();
    await MemberDAO.removeMembersOfQuiz(quizName);

    await this.cleanupQuiz(quizName);
    AMQPConnector.sendRequestStatistics();
  }

  public async resetQuiz(name: string, privateKey: string): Promise<any> {
    await QuizModel.updateOne({
      name: this.buildQuiznameQuery(name),
      privateKey,
    }, {
      state: QuizState.Active,
      currentQuestionIndex: -1,
      currentStartTimestamp: -1,
      readingConfirmationRequested: false,
    }).exec();

    const doc = await this.getQuizByName(name);
    await MemberDAO.resetMembersOfQuiz(name, doc.questionList.length);

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Reset,
    })));

    if (this._storage[name]) {
      this._storage[name].quizTimer = 1;
    } else {
      await QuizModel.updateOne({ _id: doc._id }, { currentStartTimestamp: -1 }).exec();
    }

    return doc;
  }

  public async nextQuestion(quiz: Document & QuizModelItem): Promise<number> {
    const nextIndex = quiz.currentQuestionIndex + 1;
    if (nextIndex > quiz.questionList.length) {
      return -1;
    }
    quiz.currentQuestionIndex = nextIndex;

    await QuizModel.updateOne({ _id: quiz._id }, { currentQuestionIndex: nextIndex }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.NextQuestion,
      payload: {
        nextQuestionIndex: nextIndex,
      },
    })));

    return nextIndex;
  }

  public async requestReadingConfirmation(quiz: Document & QuizModelItem): Promise<void> {
    quiz.readingConfirmationRequested = true;

    await QuizModel.updateOne({ _id: quiz._id }, { readingConfirmationRequested: true }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.ReadingConfirmationRequested,
      payload: {},
    })));
  }

  public async startNextQuestion(quiz: Document & QuizModelItem): Promise<void> {
    this.initTimerData(quiz.name);

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Start,
      payload: {},
    })));

    const quizTimer = quiz.questionList[quiz.currentQuestionIndex].timer;
    if (quizTimer <= 0) {
      return;
    }

    this._storage[quiz.name].quizTimer = quizTimer;
    this._storage[quiz.name].quizTimerInterval = setInterval(() => {
      this._storage[quiz.name].quizTimer--;
      AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
        status: StatusProtocol.Success,
        step: MessageProtocol.Countdown,
        payload: {
          value: this._storage[quiz.name].quizTimer,
        },
      })));

      if (this._storage[quiz.name].quizTimer <= 0) {
        clearInterval(this._storage[quiz.name].quizTimerInterval);
        QuizModel.updateOne({ _id: quiz._id }, { currentStartTimestamp: -1 }).exec();
      }

    }, 1000);

  }

  public async stopQuiz(quiz: Document & QuizModelItem): Promise<void> {
    if (this._storage[quiz.name]) {
      this._storage[quiz.name].quizTimer = 1;
    }

    quiz.currentStartTimestamp = -1;
    await QuizModel.updateOne({ _id: quiz._id }, { currentStartTimestamp: -1 }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Stop,
    })));
  }

  public async updateQuizSettings(quiz: Document & QuizModelItem, quizSettings: { state: boolean; target: string }): Promise<void> {
    await this.updateQuiz(quiz._id, { ['sessionConfig.' + quizSettings.target]: quizSettings.state });
    quiz.sessionConfig[quizSettings.target] = quizSettings.state;

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedSettings,
      payload: {
        sessionConfig: quiz.sessionConfig,
      },
    })));
  }

  public getQuizzesByPrivateKey(privateKey: string): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ privateKey }).exec();
  }

  public getQuizById(id: ObjectId): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({ _id: new ObjectId(id) }).exec();
  }

  private initTimerData(quizName: string): void {
    if (this._storage[quizName]) {
      clearInterval(this._storage[quizName].quizTimerInterval);
      clearInterval(this._storage[quizName].emptyQuizInterval);
    }

    this._storage[quizName] = {
      quizTimer: -1,
      quizTimerInterval: null,
      emptyQuizInterval: null,
      isEmpty: false,
    };
  }

  private replaceTypeInformationOnLegacyQuiz(obj): object {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    Object.entries(obj).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        val.forEach((elem, index) => {
          obj[key][index] = this.replaceTypeInformationOnLegacyQuiz(val[index]);
        });

      } else if (typeof val === 'object') {
        obj[key] = this.replaceTypeInformationOnLegacyQuiz(val);
      }
    });

    if (obj.hasOwnProperty('type')) {
      obj.TYPE = obj.type;
      delete obj.type;
    }
    delete obj.hashtag;

    return obj;
  }

  private getQuizByState(states: Array<QuizState>): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ state: { $in: states } }).exec();
  }

  private buildQuiznameQuery(quizName: string = ''): RegExp {
    return new RegExp(`^${quizName.trim()}$`, 'i');
  }

  private async cleanupQuiz(quizName: string): Promise<void> {
    delete this._storage[quizName];

    await AMQPConnector.channel.deleteExchange(AMQPConnector.buildQuizExchange(quizName));
  }

  private checkExistingConnection(quizName: string, privateKey: string): void {
    const reqOptions: http.RequestOptions = {
      protocol: settings.amqp.managementApi.protocol,
      host: settings.amqp.managementApi.host,
      port: settings.amqp.managementApi.port,
      path: `/api/exchanges/${encodeURIComponent(settings.amqp.vhost)}/quiz_${encodeURIComponent(encodeURIComponent(quizName))}/bindings/source`,
      auth: `${settings.amqp.managementApi.user}:${settings.amqp.managementApi.password}`,
    };

    superagent.get(reqOptions.protocol + '//' + reqOptions.host + ':' + reqOptions.port + reqOptions.path) //
    .set('Authorization', 'Basic ' + Buffer.from(reqOptions.auth).toString('base64')).then((res) => {
      if (Array.isArray(res.body) && res.body.length) {
        this._storage[quizName].isEmpty = false;
        return;
      }

      if (this._storage[quizName].isEmpty) {
        return this.setQuizAsInactive(quizName, privateKey);
      }

      this._storage[quizName].isEmpty = true;
    });
  }
}

export default QuizDAO.getInstance();
