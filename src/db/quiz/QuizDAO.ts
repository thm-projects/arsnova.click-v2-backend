import { ObjectId } from 'bson';
import WebSocket from 'ws';
import { MemberGroupEntity } from '../../entities/member/MemberGroupEntity';
import { getQuestionForType } from '../../entities/question/QuizValidator';
import { QuizEntity } from '../../entities/quiz/QuizEntity';
import { SessionConfigurationEntity } from '../../entities/session-configuration/SessionConfigurationEntity';
import { DbCollection, DbEvent } from '../../enums/DbOperation';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { IQuizEntity, IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { generateToken } from '../../lib/generateToken';
import { setPath } from '../../lib/resolveNestedObjectProperty';
import { AbstractDAO } from '../AbstractDAO';
import DbDAO from '../DbDAO';

class QuizDAO extends AbstractDAO<Array<IQuizEntity>> {

  constructor() {
    super([]);

    DbDAO.isDbAvailable.on(DbEvent.Connected, async (isConnected) => {
      if (isConnected) {
        const cursor = DbDAO.readMany(DbCollection.Quizzes, {});
        cursor.forEach(doc => {
          this.addQuiz(doc);
        }).then(() => this.updateEmitter.emit(DbEvent.Initialized));
      }
    });
  }

  public static getInstance(): QuizDAO {
    if (!this.instance) {
      this.instance = new QuizDAO();
    }

    return this.instance;
  }

  public getInactiveQuizzes(): Array<IQuizEntity> {
    return this.getQuizByState([QuizState.Inactive]);
  }

  public getActiveQuizzes(): Array<IQuizEntity> {
    return this.getQuizByState([QuizState.Active, QuizState.Finished, QuizState.Running]);
  }

  public getJoinableQuizzes(): Array<IQuizEntity> {
    return this.getQuizByState([QuizState.Active]);
  }

  public removeQuiz(id: ObjectId): void {
    this.storage.splice(this.storage.findIndex(val => val.id.equals(id)), 1);
  }

  public clearStorage(): void {
    this.storage.splice(0, this.storage.length);
  }

  public getRenameRecommendations(quizName: string): Array<string> {
    const result = [];
    if (!quizName) {
      return result;
    }

    const count = this.storage.filter((value: IQuizEntity) => {
      return value.name.trim().toLowerCase().startsWith(quizName.trim().toLowerCase());
    }).length;
    const date = new Date();
    const dateYearPart = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;
    const dateFormatted = `${dateYearPart}-${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    result.push(`${quizName} ${count + 1}`);
    result.push(`${quizName} ${dateFormatted}`);
    result.push(`${quizName} ${generateToken(quizName, new Date().getTime()).substr(0, 10)}`);
    return result;
  }

  public getLastPersistedDemoQuizNumber(): number {
    return this.getLastPersistedNumberForQuizzes(this.getAllPersistedDemoQuizzes());
  }

  public getLastPersistedAbcdQuizNumberByLength(length: number): number {
    return this.getLastPersistedNumberForQuizzes(this.getAllPersistedAbcdQuizzesByLength(length));
  }

  public getAllPersistedDemoQuizzes(): Array<IQuizEntity> {
    return this.storage.filter((value) => {
      return value.name.toLowerCase().startsWith('demo quiz');
    });
  }

  public getAllPersistedAbcdQuizzes(): Array<IQuizEntity> {
    return this.storage.filter((value) => {
      return this.checkABCDOrdering(value.name.toLowerCase());
    });
  }

  public getAllPersistedAbcdQuizzesByLength(length: number): Array<IQuizEntity> {
    return this.storage.filter((value) => {
      const abcdString = value.name.toLowerCase().match(/([a-zA-Z]*)(\s[0-9]*)/i);
      if (!abcdString || abcdString.length < 2) {
        return false;
      }
      return this.checkABCDOrdering(abcdString[1]) && value.questionList[0].answerOptionList.length === length;
    });
  }

  public convertLegacyQuiz(legacyQuiz: any): void {
    this.replaceTypeInformationOnLegacyQuiz(legacyQuiz);
    if (legacyQuiz.hasOwnProperty('configuration')) {
      // Detected old v1 arsnova.click quiz
      // noinspection TypeScriptUnresolvedVariable
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
  }

  public joinableQuizzesUpdated(): void {
    this.updateEmitter.emit(DbEvent.Change, this.getJoinableQuizzes());
  }

  public async addQuiz(quizDoc: IQuizSerialized): Promise<IQuizEntity> {
    if (this.getQuizByName(quizDoc.name)) {
      throw new Error(`Duplicate quiz insertion: ${quizDoc.name}`);
    }

    const entity = new QuizEntity(quizDoc);
    this.storage.push(entity);
    return entity;
  }

  public updateQuiz(id: ObjectId, updatedFields: any): IQuizEntity {
    const quiz = this.getQuizById(id);
    if (!quiz) {
      throw new Error(`Unknown updated quiz: ${id.toHexString()}`);
    }

    if (updatedFields.sessionConfig) {
      updatedFields.sessionConfig = new SessionConfigurationEntity(updatedFields.sessionConfig);
    }

    if (updatedFields.questionList) {
      updatedFields.questionList = updatedFields.questionList.map(val => getQuestionForType(val.TYPE, val));
    }

    if (updatedFields.memberGroups) {
      updatedFields.memberGroups = updatedFields.memberGroups.map(val => new MemberGroupEntity(val));
    }

    if (updatedFields.id) {
      updatedFields.id = new ObjectId(updatedFields.id);
    }

    Object.keys(updatedFields).forEach(key => {
      setPath(quiz, key, updatedFields[key]);
    });

    this.updateEmitter.emit(DbEvent.Change, quiz);
    return quiz;
  }

  public getQuizByName(name: string): IQuizEntity {
    return this.storage.find(val => !!val.name.trim().match(new RegExp(`^${name.trim()}$`, 'i')));
  }

  public getExpiryQuizzes(): Array<IQuizEntity> {
    return this.storage.filter(val => {
      return val.expiry instanceof Date && val.expiry.getTime() > new Date().getTime();
    });
  }

  public initQuiz(quiz: IQuizEntity): IQuizEntity {
    return this.updateQuiz(this.getQuizByName(quiz.name).id, quiz.serialize());
  }

  public getAllQuizzes(): Array<IQuizEntity> {
    return this.storage;
  }

  public isActiveQuiz(quizname: string): boolean {
    return !!this.getActiveQuizzes().find(val => !!val.name.match(new RegExp(`^${quizname}$`, 'i')));
  }

  public setQuizAsInactive(quizName: string): void {
    this.getQuizByName(quizName).state = QuizState.Inactive;
  }

  public getActiveQuizByName(quizName: string): IQuizEntity {
    return this.getActiveQuizzes().find(val => !!val.name.match(new RegExp(`^${quizName}$`, 'i')));
  }

  public getQuizBySocket(ws: WebSocket): IQuizEntity {
    return this.storage.find(quiz => quiz.containsSocket(ws));
  }

  public getQuizByToken(token: string): IQuizEntity {
    return this.storage.find(quiz => quiz.privateKey === token);
  }

  public getAllPublicQuizzes(): Array<IQuizEntity> {
    return this.storage.filter(val => val.visibility === QuizVisibility.Any);
  }

  public getQuizById(id: ObjectId | string): IQuizEntity {
    return this.storage.find(val => val.id.equals(id));
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

  private replaceTypeInformationOnLegacyQuiz(obj): void {
    if (!obj.hasOwnProperty('type')) {
      return;
    }

    obj.TYPE = obj.type;
    delete obj.type;

    Object.values(obj).forEach((val) => {
      if (Array.isArray(val)) {
        val.forEach((elem, index) => {
          this.replaceTypeInformationOnLegacyQuiz(val[index]);
        });

      } else if (typeof val === 'object') {
        this.replaceTypeInformationOnLegacyQuiz(val);
      }
    });
  }

  private getLastPersistedNumberForQuizzes(data: Array<IQuizEntity>): number {
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

  private getQuizByState(states: Array<QuizState>): Array<IQuizEntity> {
    return this.storage.filter(val => states.includes(val.state));
  }
}

export default QuizDAO.getInstance();
