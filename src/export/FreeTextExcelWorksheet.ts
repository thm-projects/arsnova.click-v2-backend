import MemberDAO from '../db/MemberDAO';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionFreetext } from '../interfaces/questions/IQuestionFreetext';
import { asyncForEach } from '../lib/async-for-each';
import { MemberModelItem } from '../models/member/MemberModel';
import { ExcelWorksheet } from './ExcelWorksheet';

export class FreeTextExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;
  private _question: IQuestionFreetext;
  private readonly _questionIndex: number;
  private allResponses: Array<MemberModelItem> = [];

  constructor({ wb, theme, translation, quiz, mf, questionIndex }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex,
    });
    this._ws = wb.addWorksheet(`${mf('export.question')} ${questionIndex + 1}`, this._options);
    this._questionIndex = questionIndex;
    this._question = this.quiz.questionList[questionIndex] as IQuestionFreetext;

    MemberDAO.getMembersOfQuizForOwner(this.quiz.name).then(members => this.allResponses = members.filter(nickname => {
      return nickname.responses.find(response => {
        return !!response.value && response.value !== -1 ? response.value : null;
      });
    }));

    this.loaded.on('load', () => Promise.all([
      this.formatSheet(), this.addSheetData(),
    ]).then(() => this.renderingFinished.emit('done')));
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();
    let minColums = 3;
    if (this.responsesWithConfidenceValue.length > 0) {
      minColums++;
    }
    if (this._isCasRequired) {
      minColums += 2;
    }
    const columnsToFormat = 4 < minColums ? minColums : 4;

    this.ws.row(1).setHeight(20);
    this.ws.column(1).setWidth(this.responsesWithConfidenceValue.length > 0 ? 40 : 30);
    this.ws.column(2).setWidth(30);
    this.ws.column(3).setWidth(45);
    this.ws.column(4).setWidth(35);

    this.ws.cell(1, 1, 1, columnsToFormat).style(defaultStyles.quizNameRowStyle);
    this.ws.cell(2, 1, 2, columnsToFormat).style(defaultStyles.exportedAtRowStyle);
    this.ws.cell(2, 2, 2, columnsToFormat).style({
      alignment: {
        horizontal: 'center',
      },
    });

    this.ws.cell(4, 1).style({
      alignment: {
        wrapText: true,
        vertical: 'top',
      },
    });
    this.ws.cell(4, 2).style({
      alignment: {
        wrapText: true,
        horizontal: 'center',
        vertical: 'center',
      },
      font: {
        color: 'FF000000',
      },
    });

    let nextRowIndex = this.responsesWithConfidenceValue.length > 0 ? 9 : 8;
    this.ws.cell(6, 1, nextRowIndex, columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(6, 2, nextRowIndex++, 2).style({
      alignment: {
        horizontal: 'center',
      },
    });
    nextRowIndex += 2;

    this.ws.cell(nextRowIndex, 1, nextRowIndex, columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(nextRowIndex, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });

    this.ws.row(nextRowIndex).filter({
      firstRow: nextRowIndex,
      firstColumn: 1,
      lastRow: nextRowIndex++,
      lastColumn: minColums,
    });

    const hasEntries = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length > 0;
    const attendeeEntryRows = hasEntries ? ((await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length) : 1;
    const attendeeEntryRowStyle = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        horizontal: 'center',
      },
    });
    this.ws.cell(nextRowIndex, 1, attendeeEntryRows + nextRowIndex - 1, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    await asyncForEach(this.allResponses, async (responseItem, indexInList) => {
      const leaderboardItem = (await this.getLeaderboardData()).filter(lbItem => lbItem.name === responseItem.name)[0];
      let nextColumnIndex = 2;
      const targetRow = indexInList + nextRowIndex;
      if (this._isCasRequired) {
        nextColumnIndex += 2;
      }
      this.ws.cell(targetRow, nextColumnIndex++).style({
        font: {
          color: 'FFFFFFFF',
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: leaderboardItem && leaderboardItem.correctQuestions.indexOf(this._questionIndex) > -1 ? 'FF008000' : 'FFB22222',
        },
      });
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(targetRow, nextColumnIndex++).style({
          alignment: {
            horizontal: 'center',
          },
        });
      }
      this.ws.cell(targetRow, nextColumnIndex).style({
        alignment: {
          horizontal: 'center',
        },
        numberFormat: defaultStyles.numberFormat,
      });
    });
  }

  public async addSheetData(): Promise<void> {
    const answerOption = this._question.answerOptionList[0];

    this.ws.cell(1, 1).string(`${this.mf('export.question_type')}: ${this.mf(`export.type.${this._question.TYPE}`)}`);
    this.ws.cell(2, 1).string(this.mf('export.question'));
    this.ws.cell(2, 2).string(this.mf('export.correct_value'));

    this.ws.cell(4, 1).string(this._question.questionText.replace(/[#]*[*]*/g, ''));
    this.ws.cell(4, 2).string(answerOption.answerText);

    let nextRowIndex = 6;
    this.ws.cell(nextRowIndex, 1).string(this.mf('export.number_of_answers') + ':');
    this.ws.cell(nextRowIndex, 2).number(this.allResponses.length);

    const configCaseSensitive = this.mf(answerOption.configCaseSensitive ? 'global.yes' : 'global.no');
    const configTrimWhitespaces = this.mf(answerOption.configTrimWhitespaces ? 'global.yes' : 'global.no');
    const configUseKeywords = this.mf(answerOption.configUseKeywords ? 'global.yes' : 'global.no');
    const configUsePunctuation = this.mf(answerOption.configUsePunctuation ? 'global.yes' : 'global.no');

    this.ws.cell(nextRowIndex, 3).string(`${this.mf('view.answeroptions.free_text_question.config_case_sensitive')}: ${configCaseSensitive}`);
    this.ws.cell(nextRowIndex++, 4).string(`${this.mf('view.answeroptions.free_text_question.config_trim_whitespaces')}: ${configTrimWhitespaces}`);

    this.ws.cell(nextRowIndex, 1).string(this.mf('export.percent_correct') + ':');
    const correctResponsesPercentage: number = (await this.getLeaderboardData()).map(leaderboard => leaderboard.correctQuestions)
                                               .filter(correctQuestions => correctQuestions.includes(this._questionIndex)).length
                                               / (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length * 100;
    this.ws.cell(nextRowIndex, 2).number((isNaN(correctResponsesPercentage) ? 0 : Math.round(correctResponsesPercentage)));

    this.ws.cell(nextRowIndex, 3).string(`${this.mf('view.answeroptions.free_text_question.config_use_keywords')}: ${configUseKeywords}`);
    this.ws.cell(nextRowIndex++, 4).string(`${this.mf('view.answeroptions.free_text_question.config_use_punctuation')}: ${configUsePunctuation}`);

    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextRowIndex, 1).string(this.mf('export.average_confidence') + ':');
      let confidenceSummary = 0;
      (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).forEach((nickItem) => {
        confidenceSummary += nickItem.responses[this._questionIndex].confidence;
      });
      this.ws.cell(nextRowIndex++, 2).number(Math.round(confidenceSummary / this.responsesWithConfidenceValue.length));
    }

    this.ws.cell(nextRowIndex, 1).string(this.mf('export.required_for_token') + ':');
    this.ws.cell(nextRowIndex++, 2).string(this.mf('global.' + (this._question.requiredForToken ? 'yes' : 'no')));

    let nextColumnIndex = 1;
    nextRowIndex += 2;
    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.attendee'));
    if (this._isCasRequired) {
      this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }
    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.answer'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.confidence_level'));
    }
    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.time'));

    let nextStartRow = nextRowIndex;
    this.allResponses.forEach((nickItem) => {
      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(nickItem.name);
      if (this._isCasRequired) {
        const profile = nickItem.casProfile;
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.mail[0]);
      }
      this.ws.cell(nextStartRow, nextColumnIndex++).string(nickItem.responses[this._questionIndex].value);
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(Math.round(nickItem.responses[this._questionIndex].confidence));
      }
      const responseTime = this.formatMillisToSeconds(nickItem.responses[this._questionIndex].responseTime);
      if (responseTime) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(responseTime);
      } else {
        this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.no_answer'));
      }
    });
    if (nextStartRow === nextRowIndex) {
      this.ws.cell(nextRowIndex + 1, 1).string(this.mf('export.attendee_complete_correct_none_available'));
    }
  }
}
