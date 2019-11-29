import { ObjectId } from 'bson';
import { Document } from 'mongoose';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { generateToken } from '../../lib/generateToken';
import { QuizModel, QuizModelItem } from '../../models/quiz/QuizModelItem';
import { AbstractDAO } from '../AbstractDAO';
import AMQPConnector from '../AMQPConnector';
import MemberDAO from '../MemberDAO';

class QuizDAO extends AbstractDAO {
  private readonly _storage: { [key: string]: { quizTimer: number, quizTimerInterval: NodeJS.Timeout } };

  constructor(storage) {
    super();
    this._storage = storage;
  }

  public static getInstance(): QuizDAO {
    if (!this.instance) {
      this.instance = new QuizDAO({});
    }

    return this.instance;
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

  public async removeQuiz(id: ObjectId): Promise<void> {
    const removedQuiz = await this.getQuizById(id);
    await QuizModel.deleteOne({ _id: id }).exec();
    await MemberDAO.removeMembersOfQuiz(removedQuiz.name);
    await this.cleanupQuiz(removedQuiz.name);
  }

  public async getRenameRecommendations(quizName: string): Promise<Array<string>> {
    const result = [];
    if (!quizName) {
      return result;
    }

    const count = await QuizModel.find({ name: this.buildQuiznameQuery(quizName) }).count().exec();
    const date = new Date();
    const dateYearPart = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;
    const dateFormatted = `${dateYearPart}-${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    result.push(`${quizName} ${count + 1}`);
    result.push(`${quizName} ${dateFormatted}`);
    result.push(`${quizName} ${generateToken(quizName, new Date().getTime()).substr(0, 10)}`);
    return result;
  }

  public async getLastPersistedDemoQuizNumber(): Promise<number> {
    return this.getLastPersistedNumberForQuizzes(await this.getAllPersistedDemoQuizzes());
  }

  public async getLastPersistedAbcdQuizNumberByLength(length: number): Promise<number> {
    return this.getLastPersistedNumberForQuizzes(await this.getAllPersistedAbcdQuizzesByLength(length));
  }

  public getAllPersistedDemoQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ name: /^demo quiz/i }).exec();
  }

  public async getAllPersistedAbcdQuizzes(): Promise<Array<Document & QuizModelItem>> {
    const quizzes = await QuizModel.find({ name: /([a-zA-Z]*)(\s[0-9]*)/i }).exec();
    return quizzes.filter((value) => {
      return this.checkABCDOrdering(value.name.toLowerCase());
    });
  }

  public async getAllPersistedAbcdQuizzesByLength(length: number): Promise<Array<Document & QuizModelItem>> {
    const quizzes = await QuizModel.find({ name: { $gte: length } }).exec();
    return quizzes.filter(val => {
      const abcdString = val.name.toLowerCase().match(/([a-zA-Z]*)(\s[0-9]*)/i);
      if (!abcdString || abcdString.length < 2) {
        return false;
      }

      return this.checkABCDOrdering(abcdString[1]) && val.questionList[0].answerOptionList.length === length;
    });
  }

  public convertLegacyQuiz(legacyQuiz: any): Document & QuizModelItem {
    legacyQuiz = this.replaceTypeInformationOnLegacyQuiz(legacyQuiz);
    if (legacyQuiz.hasOwnProperty('configuration')) {
      // Detected old v1 arsnova.click quiz
      legacyQuiz.name = legacyQuiz.hashtag;
      delete legacyQuiz.hashtag;

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
    return QuizModel.create(quizDoc);
  }

  public updateQuiz(id: ObjectId, updatedFields: any): Promise<void> {
    return QuizModel.updateOne({ _id: new ObjectId(id) }, updatedFields).exec();
  }

  public getQuizByName(name: string): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({ name: this.buildQuiznameQuery(name) }).exec();
  }

  public getExpiryQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ expiry: { $gte: new Date() } }).exec();
  }

  public async initQuiz(quiz: Document & QuizModelItem): Promise<void> {
    quiz.state = QuizState.Active;
    this.initTimerData(quiz);
    await this.updateQuiz(new ObjectId(quiz._id), quiz);
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
    }, { state: QuizState.Inactive }).exec();

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetInactive,
      payload: {
        quizName,
      },
    })));

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

  public getQuizByToken(privateKey: string): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({ privateKey }).exec();
  }

  public getAllPublicQuizzes(): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({
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

    this._storage[name].quizTimer = 1;

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
    if (this._storage[quiz.name]) {
      clearInterval(this._storage[quiz.name].quizTimerInterval);
    }

    this.initTimerData(quiz);
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
    if (this._storage[quiz.name].quizTimer) {
      this._storage[quiz.name].quizTimer = 1;
    }

    quiz.currentStartTimestamp = -1;
    await QuizModel.updateOne({ _id: quiz._id }, { currentStartTimestamp: -1 }).exec();

    AMQPConnector.channel.publish(AMQPConnector.buildQuizExchange(quiz.name), '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Stop,
    })));
  }

  public getQuizzesByPrivateKey(privateKey: string): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ privateKey }).exec();
  }

  public getQuizById(id: ObjectId): Promise<Document & QuizModelItem> {
    return QuizModel.findOne({ _id: new ObjectId(id) }).exec();
  }

  private initTimerData(quiz: QuizModelItem): void {
    this._storage[quiz.name] = {
      quizTimer: -1,
      quizTimerInterval: null,
    };
  }

  private checkABCDOrdering(quizname: string): boolean {
    let ordered = true;
    if (!quizname || quizname.length < 2 || quizname.charAt(0) !== 'a') {
      return false;
    }
    for (let i = 1; i < quizname.length; i++) {
      if (quizname.charCodeAt(i) !== quizname.charCodeAt(i - 1) + 1) {
        ordered = false;
        break;
      }
    }
    return ordered;
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

    return obj;
  }

  private getLastPersistedNumberForQuizzes(data: Array<Document & QuizModelItem>): number {
    let maxNumber = 0;
    data.forEach((quiz => {
      const name = quiz.name;
      const currentNumber = parseInt(name.substring(name.lastIndexOf(' '), name.length), 10);
      if (currentNumber > maxNumber) {
        maxNumber = currentNumber;
      }
    }));
    return maxNumber;
  }

  private getQuizByState(states: Array<QuizState>): Promise<Array<Document & QuizModelItem>> {
    return QuizModel.find({ state: { $in: states } }).exec();
  }

  private buildQuiznameQuery(quizName: string): RegExp {
    return new RegExp(`^${quizName.trim()}$`, 'i');
  }

  private async cleanupQuiz(quizName: string): Promise<void> {
    delete this._storage[quizName];

    await AMQPConnector.channel.deleteExchange(AMQPConnector.buildQuizExchange(quizName));
  }
}

export default QuizDAO.getInstance();
