import { EventEmitter } from 'events';
import * as xlsx from 'excel4node';
import * as MessageFormat from 'messageformat';
import { Document } from 'mongoose';
import MemberDAO from '../db/MemberDAO';
import { ILeaderBoardItemBase } from '../interfaces/leaderboard/ILeaderBoardItemBase';
import { IQuizBase } from '../interfaces/quizzes/IQuizEntity';
import { Leaderboard } from '../lib/leaderboard/leaderboard';
import { MemberModelItem } from '../models/member/MemberModel';
import { excelDefaultWorksheetOptions } from './lib/excel_default_options';
import { ExcelTheme } from './lib/excel_default_styles';

export abstract class ExcelWorksheet {
  public readonly renderingFinished = new EventEmitter();

  get quiz(): IQuizBase {
    return this._quiz;
  }

  get createdAt(): string {
    return this._createdAt;
  }

  get mf(): MessageFormat.Msg {
    return this._mf;
  }

  protected _ws: xlsx.Worksheet;

  get ws(): xlsx.Worksheet {
    return this._ws;
  }

  private _responsesWithConfidenceValue: Array<Document & MemberModelItem>;

  get responsesWithConfidenceValue(): Array<Document & MemberModelItem> {
    return this._responsesWithConfidenceValue;
  }

  private _columnsToFormat: number;

  get columnsToFormat(): number {
    return this._columnsToFormat;
  }

  protected _options: Object;
  protected _theme: ExcelTheme;
  protected _translation: string;
  protected readonly loaded = new EventEmitter();
  private readonly _mf: MessageFormat.Msg;
  private readonly _createdAt: string;
  private readonly _quiz: IQuizBase;

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

    this._columnsToFormat = 5;

    MemberDAO.getMembersOfQuizForOwner(this._quiz.name).then(members => {
      if (questionIndex) {
        this._responsesWithConfidenceValue = members.filter(nickname => {
          return nickname.responses[questionIndex].confidence > -1;
        });
      } else {
        this._responsesWithConfidenceValue = members.filter(nickname => {
          return nickname.responses.some(responseItem => responseItem.confidence > -1);
        });
      }

      if (this._responsesWithConfidenceValue.length > 0) {
        this._columnsToFormat++;
      }

      this.loaded.emit('load');
    });

    if (this._quiz.sessionConfig.nicks.restrictToCasLogin) {
      this._columnsToFormat += 2;
    }
  }

  protected generateCreatedAtString(): string {
    const date = new Date();
    const dateYMD = `${this.prefixNumberWithZero(date.getDate())}.${this.prefixNumberWithZero(date.getMonth() + 1)}.${date.getFullYear()}`;
    const dateHM = `${this.prefixNumberWithZero(date.getHours())}:${this.prefixNumberWithZero(date.getMinutes())}`;
    return `${dateYMD} ${this._mf('export.exported_at')} ${dateHM} ${this._mf('export.exported_at_time')}`;
  }

  protected async getLeaderboardData(): Promise<Array<ILeaderBoardItemBase>> {
    const leaderBoard = new Leaderboard();
    const { correctResponses } = await leaderBoard.buildLeaderboard(this.quiz);
    return leaderBoard.sortBy(correctResponses, 'score');
  }

  private prefixNumberWithZero(num: number): string {
    return `${num < 10 ? '0' : ''}${num}`;
  }
}
