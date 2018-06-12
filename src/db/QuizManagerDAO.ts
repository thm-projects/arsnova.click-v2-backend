import { IActiveQuiz } from 'arsnova-click-v2-types/src/common';
import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import { parseCachedAssetQuiz } from '../cache/assets';
import { ActiveQuizItem, ActiveQuizItemPlaceholder, MemberGroup } from '../quiz-manager/quiz-manager';
import { settings } from '../statistics';
import { DatabaseTypes, DbDAO } from './DbDAO';

export class QuizManagerDAO {
  private static readonly activeQuizzes = {};

  public static createDump(): {} {
    return QuizManagerDAO.activeQuizzes;
  }

  public static normalizeQuizName(quizName: string): string {
    return quizName ? quizName.toLowerCase() : '';
  }

  public static getRenameRecommendations(quizName: string): Array<string> {
    const result = [];
    const count = Object.keys(this.activeQuizzes).filter((value: string) => {
      const name: string = QuizManagerDAO.normalizeQuizName(value);
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

  public static setQuizAsInactive(quizName: string): void {
    const name: string = QuizManagerDAO.normalizeQuizName(quizName);
    if (this.activeQuizzes[name]) {
      this.activeQuizzes[name] = new ActiveQuizItemPlaceholder(name);
    }
  }

  public static initInactiveQuiz(quizName: string): void {
    const name: string = QuizManagerDAO.normalizeQuizName(quizName);
    if (this.activeQuizzes[name]) {
      return;
    }
    this.activeQuizzes[name] = new ActiveQuizItemPlaceholder(name);
  }

  public static initActiveQuiz(quiz: IQuestionGroup): IActiveQuiz {
    const name: string = QuizManagerDAO.normalizeQuizName(quiz.hashtag);
    if (!this.activeQuizzes[name] || !(
      this.activeQuizzes[name] instanceof ActiveQuizItemPlaceholder
    )) {
      console.log('trying to init an active quiz which is not inactive');
      return;
    }
    QuizManagerDAO.convertLegacyQuiz(quiz);
    if (settings.public.cacheQuizAssets) {
      parseCachedAssetQuiz(quiz.questionList);
    }
    const memberGroups = quiz.sessionConfig.nicks.memberGroups.map(groupName => new MemberGroup(groupName));
    this.activeQuizzes[name] = new ActiveQuizItem({ memberGroups, originalObject: quiz, currentQuestionIndex: -1 });
    return this.activeQuizzes[name];
  }

  public static removeQuiz(originalName: string): boolean {
    const name: string = QuizManagerDAO.normalizeQuizName(originalName);
    if (!this.activeQuizzes[name]) {
      return;
    }
    delete this.activeQuizzes[name];
    return true;
  }

  public static getActiveQuizByName(originalName: string): IActiveQuiz {
    const name: string = QuizManagerDAO.normalizeQuizName(originalName);
    if (this.activeQuizzes[name] instanceof ActiveQuizItemPlaceholder) {
      return;
    }
    return this.activeQuizzes[name];
  }

  public static updateActiveQuiz(data: IActiveQuiz): void {
    const name: string = QuizManagerDAO.normalizeQuizName(data.originalObject.hashtag);
    if (this.activeQuizzes[name] instanceof ActiveQuizItemPlaceholder) {
      return;
    }
    this.activeQuizzes[name] = data;
  }

  public static getAllActiveQuizNames(): Array<string> {
    return Object.keys(this.activeQuizzes).filter(name => !this.isInactiveQuiz(name));
  }

  public static getAllPersistedQuizzes(): Object {
    return this.activeQuizzes;
  }

  public static getPersistedQuizByName(originalName: string): IActiveQuiz {
    const name: string = QuizManagerDAO.normalizeQuizName(originalName);
    return this.activeQuizzes[name];
  }

  public static isActiveQuiz(originalName: string): boolean {
    const name: string = QuizManagerDAO.normalizeQuizName(originalName);
    return this.activeQuizzes[name] && this.activeQuizzes[name] instanceof ActiveQuizItem;
  }

  public static isInactiveQuiz(originalName: string): boolean {
    const name: string = QuizManagerDAO.normalizeQuizName(originalName);
    return this.activeQuizzes[name] && this.activeQuizzes[name] instanceof ActiveQuizItemPlaceholder;
  }

  public static getAllActiveMembers(): number {
    let memberCount = 0;

    Object.keys(this.activeQuizzes).forEach(quiz => {
      const name: string = QuizManagerDAO.normalizeQuizName(quiz);
      if (this.activeQuizzes[name] instanceof ActiveQuizItemPlaceholder) {
        return;
      }

      this.activeQuizzes[name].memberGroups.forEach(memberGroup => {
        memberCount += memberGroup.members.length;
      });
    });

    return memberCount;
  }

  public static getLastPersistedNumberForData(data): number {
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

  public static getLastPersistedDemoQuizNumber(): number {
    return QuizManagerDAO.getLastPersistedNumberForData(QuizManagerDAO.getAllPersistedDemoQuizzes());
  }

  public static getLastPersistedAbcdQuizNumberByLength(length: number): number {
    return QuizManagerDAO.getLastPersistedNumberForData(QuizManagerDAO.getAllPersistedAbcdQuizzesByLength(length));
  }

  public static getAllPersistedDemoQuizzes(): String[] {
    return Object.keys(this.activeQuizzes).filter((value: string) => {
      const name: string = QuizManagerDAO.normalizeQuizName(value);
      return this.activeQuizzes[name].name.toLowerCase().startsWith('demo quiz');
    });
  }

  public static getAllPersistedAbcdQuizzes(): String[] {
    return Object.keys(this.activeQuizzes).filter((value: string) => {
      const name: string = QuizManagerDAO.normalizeQuizName(value);
      return QuizManagerDAO.checkABCDOrdering(this.activeQuizzes[name].name);
    });
  }

  public static getAllPersistedAbcdQuizzesByLength(length: number): String[] {
    return Object.keys(this.activeQuizzes).filter((value: string) => {
      const name: string = QuizManagerDAO.normalizeQuizName(value);
      return QuizManagerDAO.checkABCDOrdering(this.activeQuizzes[name].name)
             && this.activeQuizzes[name].originalObject.questionList[0].answerOptionList.length === length;
    });
  }

  public static convertLegacyQuiz(legacyQuiz: any): void {
    QuizManagerDAO.replaceTypeInformationOnLegacyQuiz(legacyQuiz);
    if (legacyQuiz.hasOwnProperty('configuration')) {
      // Detected old v1 arsnova.click quiz
      legacyQuiz.sessionConfig = {
        music: {
          titleConfig: {
            lobby: legacyQuiz.configuration.music.lobbyTitle,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningTitle,
            countdownEnd: legacyQuiz.configuration.music.countdownEndTitle,
          }, volumeConfig: {
            global: legacyQuiz.configuration.music.lobbyVolume,
            lobby: legacyQuiz.configuration.music.lobbyVolume,
            countdownRunning: legacyQuiz.configuration.music.countdownRunningVolume,
            countdownEnd: legacyQuiz.configuration.music.countdownEndVolume,
            useGlobalVolume: legacyQuiz.configuration.music.isUsingGlobalVolume,
          }, enabled: {
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

  private static checkABCDOrdering(hashtag: string): boolean {
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

  private static replaceTypeInformationOnLegacyQuiz(obj): void {
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

DbDAO.getState()[DatabaseTypes.quiz].forEach((value) => {
  QuizManagerDAO.initInactiveQuiz(value.quizName);
});
