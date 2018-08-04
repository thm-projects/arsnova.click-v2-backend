import { IActiveQuiz } from 'arsnova-click-v2-types/dist/common';
import { IQuestionGroup } from 'arsnova-click-v2-types/dist/questions/interfaces';
import { EventEmitter } from 'events';
import { parseCachedAssetQuiz } from '../cache/assets';
import { DATABASE_TYPE } from '../Enums';
import { ActiveQuizItem, ActiveQuizItemPlaceholder, MemberGroup } from '../quiz-manager/quiz-manager';
import { settings } from '../statistics';
import { AbstractDAO } from './AbstractDAO';
import { default as DbDAO } from './DbDAO';

class QuizManagerDAO extends AbstractDAO<{ [key: string]: IActiveQuiz }> {
  private _quizStatusUpdateEmitter = new EventEmitter();

  get quizStatusUpdateEmitter(): EventEmitter {
    return this._quizStatusUpdateEmitter;
  }

  public static getInstance(): QuizManagerDAO {
    if (!this.instance) {
      this.instance = new QuizManagerDAO({});
    }
    return this.instance;
  }

  public normalizeQuizName(quizName: string): string {
    return quizName ? quizName.toLowerCase() : '';
  }

  public getRenameRecommendations(quizName: string): Array<string> {
    const result = [];
    const count = Object.keys(this.storage).filter((value: string) => {
      const name: string = this.normalizeQuizName(value);
      return name.startsWith(quizName.toLowerCase());
    }).length;
    const date = new Date();
    const dateYearPart = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}`;
    const dateFormatted = `${dateYearPart}-${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    result.push(`${quizName} ${count + 1}`);
    result.push(`${quizName} ${dateFormatted}`);
    result.push(`${quizName}_${Math.random()}`);
    return result;
  }

  public setQuizAsInactive(quizName: string): void {
    const name: string = this.normalizeQuizName(quizName);
    if (this.storage[name]) {
      this.storage[name] = new ActiveQuizItemPlaceholder(name);

      this.quizStatusUpdated();
    }
  }

  public initInactiveQuiz(quizName: string): void {
    const name: string = this.normalizeQuizName(quizName);
    if (this.storage[name]) {
      return;
    }
    this.storage[name] = new ActiveQuizItemPlaceholder(name);
  }

  public initActiveQuiz(quiz: IQuestionGroup): IActiveQuiz {
    const name: string = this.normalizeQuizName(quiz.hashtag);
    if (!this.storage[name] || !(
      this.storage[name] instanceof ActiveQuizItemPlaceholder
    )) {
      throw new Error('trying to init an active quiz which is not inactive');
    }
    this.convertLegacyQuiz(quiz);
    if (settings.public.cacheQuizAssets) {
      parseCachedAssetQuiz(quiz.questionList);
    }
    const memberGroups = quiz.sessionConfig.nicks.memberGroups.map(groupName => new MemberGroup(groupName));
    this.storage[name] = new ActiveQuizItem({
      memberGroups,
      originalObject: quiz,
      currentQuestionIndex: -1,
    });
    this.quizStatusUpdated();
    return this.storage[name];
  }

  public removeQuiz(originalName: string): boolean {
    const name: string = this.normalizeQuizName(originalName);
    if (!this.storage[name]) {
      return;
    }
    delete this.storage[name];
    return true;
  }

  public getActiveQuizByName(originalName: string): IActiveQuiz {
    const name: string = this.normalizeQuizName(originalName);
    if (this.storage[name] instanceof ActiveQuizItemPlaceholder) {
      return;
    }
    return this.storage[name];
  }

  // noinspection JSUnusedGlobalSymbols
  public updateActiveQuiz(data: IActiveQuiz): void {
    const name: string = this.normalizeQuizName(data.originalObject.hashtag);
    if (this.storage[name] instanceof ActiveQuizItemPlaceholder) {
      return;
    }
    this.storage[name] = data;
  }

  public getAllJoinableQuizNames(): Array<string> {
    return Object.keys(this.storage).filter(name => !this.isInactiveQuiz(name) && this.storage[name].currentQuestionIndex === -1);
  }

  public getAllActiveQuizNames(): Array<string> {
    return Object.keys(this.storage).filter(name => !this.isInactiveQuiz(name));
  }

  public getAllPersistedQuizzes(): Object {
    return this.storage;
  }

  public getPersistedQuizByName(originalName: string): IActiveQuiz {
    const name: string = this.normalizeQuizName(originalName);
    return this.storage[name];
  }

  public isActiveQuiz(originalName: string): boolean {
    const name: string = this.normalizeQuizName(originalName);
    return this.storage[name] && this.storage[name] instanceof ActiveQuizItem;
  }

  public isInactiveQuiz(originalName: string): boolean {
    const name: string = this.normalizeQuizName(originalName);
    return this.storage[name] && this.storage[name] instanceof ActiveQuizItemPlaceholder;
  }

  public getAllActiveMembers(): number {
    let memberCount = 0;

    Object.keys(this.storage).forEach(quiz => {
      const name: string = this.normalizeQuizName(quiz);
      if (this.storage[name] instanceof ActiveQuizItemPlaceholder) {
        return;
      }

      this.storage[name].memberGroups.forEach(memberGroup => {
        memberCount += memberGroup.members.length;
      });
    });

    return memberCount;
  }

  public getLastPersistedNumberForData(data): number {
    let maxNumber = 0;
    data.forEach((
      demoQuizName => {
        const currentNumber = parseInt(demoQuizName.substring(demoQuizName.lastIndexOf(' '), demoQuizName.length), 10);
        if (currentNumber > maxNumber) {
          maxNumber = currentNumber;
        }
      }
    ));
    return maxNumber;
  }

  public getLastPersistedDemoQuizNumber(): number {
    return this.getLastPersistedNumberForData(this.getAllPersistedDemoQuizzes());
  }

  public getLastPersistedAbcdQuizNumberByLength(length: number): number {
    return this.getLastPersistedNumberForData(this.getAllPersistedAbcdQuizzesByLength(length));
  }

  public getAllPersistedDemoQuizzes(): String[] {
    return Object.keys(this.storage).filter((value: string) => {
      const name: string = this.normalizeQuizName(value);
      return this.storage[name].name.toLowerCase().startsWith('demo quiz');
    });
  }

  // noinspection JSUnusedGlobalSymbols
  public getAllPersistedAbcdQuizzes(): String[] {
    return Object.keys(this.storage).filter((value: string) => {
      const name: string = this.normalizeQuizName(value);
      return this.checkABCDOrdering(this.storage[name].name);
    });
  }

  public getAllPersistedAbcdQuizzesByLength(length: number): String[] {
    return Object.keys(this.storage).filter((value: string) => {
      const name: string = this.normalizeQuizName(value);
      return this.checkABCDOrdering(this.storage[name].name) && this.storage[name].originalObject.questionList[0].answerOptionList.length === length;
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
        },
        theme: legacyQuiz.configuration.theme,
        readingConfirmationEnabled: legacyQuiz.configuration.readingConfirmationEnabled,
        showResponseProgress: legacyQuiz.configuration.showResponseProgress,
        confidenceSliderEnabled: legacyQuiz.configuration.confidenceSliderEnabled,
      };
      delete legacyQuiz.configuration;
    }
  }

  public quizStatusUpdated(): void {
    this._quizStatusUpdateEmitter.emit('update', this.getAllJoinableQuizNames());
  }

  private checkABCDOrdering(hashtag: string): boolean {
    let ordered = true;
    if (!hashtag || hashtag.length < 2 || hashtag.charAt(0) !== 'a') {
      return false;
    }
    for (let i = 1; i < hashtag.length; i++) {
      if (hashtag.charCodeAt(i) !== hashtag.charCodeAt(i - 1) + 1) {
        ordered = false;
        break;
      }
    }
    return ordered;
  }

  private replaceTypeInformationOnLegacyQuiz(obj): void {
    if (obj.hasOwnProperty('type')) {
      obj.TYPE = obj.type;
      delete obj.type;
      Object.keys(obj).forEach((key) => {
        if (obj[key] instanceof Array) {
          obj[key].forEach((elem, index) => {
            this.replaceTypeInformationOnLegacyQuiz(obj[key][index]);
          });
        } else if (obj[key] instanceof Object) {
          this.replaceTypeInformationOnLegacyQuiz(obj[key]);
        }
      });
    }
  }
}

DbDAO.getState()[DATABASE_TYPE.QUIZ].forEach((value) => {
  QuizManagerDAO.getInstance().initInactiveQuiz(value.quizName);
});

export default QuizManagerDAO.getInstance();
