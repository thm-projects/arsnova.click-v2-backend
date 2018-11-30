import { IActiveQuiz, ILeaderBoardItem, INickname } from 'arsnova-click-v2-types/dist/common';
import { IQuestion } from 'arsnova-click-v2-types/dist/questions/interfaces';
import * as xlsx from 'excel4node';
import * as MessageFormat from 'messageformat';
import { Leaderboard } from '../leaderboard/leaderboard';
import { excelDefaultWorksheetOptions } from './lib/excel_default_options';

import { ExcelTheme } from './lib/excel_default_styles';

export abstract class ExcelWorksheet {
  get responsesWithConfidenceValue(): Array<INickname> {
    return this._responsesWithConfidenceValue;
  }

  get columnsToFormat(): number {
    return this._columnsToFormat;
  }

  get quiz(): IActiveQuiz {
    return this._quiz;
  }

  get createdAt(): string {
    return this._createdAt;
  }

  get mf(): MessageFormat.Msg {
    return this._mf;
  }

  protected _leaderBoardData: Array<ILeaderBoardItem>;

  get leaderBoardData(): Array<ILeaderBoardItem> {
    return this._leaderBoardData;
  }

  protected _ws: xlsx.Worksheet;

  get ws(): xlsx.Worksheet {
    return this._ws;
  }

  protected _options: Object;
  protected _theme: ExcelTheme;
  protected _translation: string;
  private readonly _mf: MessageFormat.Msg;
  private readonly _createdAt: string;
  private readonly _quiz: IActiveQuiz;
  private readonly _columnsToFormat: number;
  private readonly _responsesWithConfidenceValue: Array<INickname>;

  protected constructor({ theme, translation, quiz, mf, questionIndex }) {
    this._theme = theme;
    this._translation = translation;
    this._quiz = quiz;
    this._mf = mf;
    this._createdAt = this.generateCreatedAtString();
    this._options = Object.assign({}, excelDefaultWorksheetOptions, {
      headerFooter: {
        firstHeader: mf('export.page_header', { createdAt: this._createdAt }),
        firstFooter: mf('export.page_footer'),
        evenHeader: mf('export.page_header', { createdAt: this._createdAt }),
        evenFooter: mf('export.page_footer'),
        oddHeader: mf('export.page_header', { createdAt: this._createdAt }),
        oddFooter: mf('export.page_footer'),
        alignWithMargins: true,
        scaleWithDoc: false,
      },
    });

    this._columnsToFormat = 4;
    if (questionIndex) {
      this._responsesWithConfidenceValue = this._quiz.memberGroups[0].members.filter(nickname => {
        return nickname.responses[questionIndex].confidence > -1;
      });
    } else {
      this._responsesWithConfidenceValue = this._quiz.memberGroups[0].members.filter(nickname => {
        return nickname.responses.filter(responseItem => responseItem.confidence > -1).length;
      });
    }
    if (this._responsesWithConfidenceValue.length > 0) {
      this._columnsToFormat++;
    }
    if (this._quiz.originalObject.sessionConfig.nicks.restrictToCasLogin) {
      this._columnsToFormat += 2;
    }

    this._leaderBoardData = this.getLeaderboardData(questionIndex);
  }

  protected generateCreatedAtString(): string {
    const date = new Date();
    const dateYMD = `${this.prefixNumberWithZero(date.getDate())}.${this.prefixNumberWithZero(date.getMonth() + 1)}.${date.getFullYear()}`;
    const dateHM = `${this.prefixNumberWithZero(date.getHours())}:${this.prefixNumberWithZero(date.getMinutes())}`;
    return `${dateYMD} ${this._mf('export.exported_at')} ${dateHM} ${this._mf('export.exported_at_time')}`;
  }

  protected getLeaderboardData(questionIndex: number): Array<ILeaderBoardItem> {
    const leaderBoard = new Leaderboard();
    const correctResponses: any = {};

    const question: IQuestion = this.quiz.originalObject.questionList[questionIndex];
    this.quiz.memberGroups[0].members.forEach(attendee => {
      if (leaderBoard.isCorrectResponse(attendee.responses[questionIndex], question) === 1) {
        if (!correctResponses[attendee.name]) {
          correctResponses[attendee.name] = {
            responseTime: 0,
            correctQuestions: [],
            confidenceValue: 0,
          };
        }
        correctResponses[attendee.name].responseTime += <number>attendee.responses[questionIndex].responseTime;
        correctResponses[attendee.name].correctQuestions.push(questionIndex);
        correctResponses[attendee.name].confidenceValue += <number>attendee.responses[questionIndex].confidence;
      } else {
        delete correctResponses[attendee.name];
      }
    });

    return leaderBoard.objectToArray(correctResponses);
  }

  private prefixNumberWithZero(num: number): string {
    return `${num < 10 ? '0' : ''}${num}`;
  }
}
