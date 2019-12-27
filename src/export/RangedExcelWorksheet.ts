import MemberDAO from '../db/MemberDAO';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionRanged } from '../interfaces/questions/IQuestionRanged';
import { asyncForEach } from '../lib/async-for-each';
import { MemberModelItem } from '../models/member/MemberModel';
import { ExcelWorksheet } from './ExcelWorksheet';
import { calculateNumberOfRangedAnswers } from './lib/excel_function_library';

export class RangedExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;
  private readonly _question: IQuestionRanged;
  private readonly _questionIndex: number;

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
    this._question = this.quiz.questionList[questionIndex] as IQuestionRanged;

    this.loaded.on('load', () => Promise.all([
      this.formatSheet(), this.addSheetData(),
    ]).then(() => this.renderingFinished.emit('done')));
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();
    const answerCellStyle = {
      alignment: {
        vertical: 'center',
        horizontal: 'center',
      },
      font: {
        color: 'FF000000',
      },
      fill: {
        type: 'pattern',
        patternType: 'solid',
        fgColor: 'FFFFE200',
      },
    };
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
    this.ws.column(2).setWidth(20);
    this.ws.column(3).setWidth(20);
    this.ws.column(4).setWidth(20);

    this.ws.cell(1, 1, 1, columnsToFormat).style(defaultStyles.quizNameRowStyle);
    this.ws.cell(2, 1, 2, columnsToFormat).style(defaultStyles.exportedAtRowStyle);
    this.ws.cell(2, 2, 2, columnsToFormat).style({
      alignment: {
        horizontal: 'center',
      },
    });

    this.ws.cell(4, 1).style(defaultStyles.questionCellStyle);
    this.ws.cell(4, 2).style(Object.assign({}, answerCellStyle, {
      border: {
        right: {
          style: 'thin',
          color: 'black',
        },
      },
    }));
    this.ws.cell(4, 3).style(Object.assign({}, answerCellStyle, {
      border: {
        right: {
          style: 'thin',
          color: 'black',
        },
      },
      font: {
        color: 'FFFFFFFF',
      },
      fill: {
        type: 'pattern',
        patternType: 'solid',
        fgColor: 'FF008000',
      },
    }));
    this.ws.cell(4, 4).style(answerCellStyle);

    this.ws.cell(6, 1, this.responsesWithConfidenceValue.length > 0 ? 8 : 7, columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(6, 2).style(Object.assign({}, defaultStyles.statisticsRowInnerStyle, {
      alignment: {
        horizontal: 'center',
      },
    }));
    this.ws.cell(6, 3).style(Object.assign({}, defaultStyles.statisticsRowInnerStyle, {
      alignment: {
        horizontal: 'center',
      },
    }));
    this.ws.cell(6, 4).style(Object.assign({}, defaultStyles.statisticsRowInnerStyle, {
      alignment: {
        horizontal: 'center',
      },
    }));

    this.ws.cell(7, 1).style(defaultStyles.statisticsRowInnerStyle);
    this.ws.cell(7, 2).style(Object.assign({}, defaultStyles.statisticsRowInnerStyle, {
      alignment: {
        horizontal: 'center',
      },
    }));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(8, 1).style(defaultStyles.statisticsRowInnerStyle);
      this.ws.cell(8, 2).style(Object.assign({}, defaultStyles.statisticsRowInnerStyle, {
        alignment: {
          horizontal: 'center',
        },
      }));
    }

    this.ws.cell(10, 1, 10, columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(10, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });

    this.ws.row(10).filter({
      firstRow: 10,
      firstColumn: 1,
      lastRow: 10,
      lastColumn: minColums,
    });

    const leaderBoardData = await this.getLeaderboardData();

    const hasEntries = leaderBoardData.length > 0;
    const attendeeEntryRows = hasEntries ? (
      leaderBoardData.length
    ) : 1;
    const attendeeEntryRowStyle = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        horizontal: 'center',
      },
    });
    this.ws.cell(11, 1, attendeeEntryRows + 10, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    await asyncForEach(leaderBoardData, async (leaderboardItem, indexInList) => {
      let nextColumnIndex = 2;
      const targetRow = indexInList + 11;
      if (this._isCasRequired) {
        nextColumnIndex += 2;
      }
      const responseItem = (
        await MemberDAO.getMembersOfQuiz(this.quiz.name)
      ).filter(nickitem => {
        return nickitem.name === leaderboardItem.name;
      })[0].responses[this._questionIndex];
      const castedQuestion = this._question as IQuestionRanged;
      const castedResponseValue = parseInt(responseItem.value as string, 10);
      this.ws.cell(targetRow, nextColumnIndex++).style({
        alignment: {
          horizontal: 'center',
        },
        font: {
          color: castedResponseValue === castedQuestion.correctValue || //
                 castedResponseValue < castedQuestion.rangeMin || //
                 castedResponseValue > castedQuestion.rangeMax ? //
                 'FFFFFFFF' : 'FF000000',
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: castedResponseValue === castedQuestion.correctValue ? //
                   'FF008000' : castedResponseValue < castedQuestion.rangeMin || //
                                castedResponseValue > castedQuestion.rangeMax ? //
                                'FFB22222' : 'FFFFE200',
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
        numberFormat: '#,##0;',
      });
    });
  }

  public async addSheetData(): Promise<void> {
    const leaderBoardData = await this.getLeaderboardData();
    const castedQuestion = this._question as IQuestionRanged;
    const numberOfInputValuesPerGroup = await calculateNumberOfRangedAnswers(this.quiz, this._questionIndex, castedQuestion.rangeMin,
      castedQuestion.correctValue, castedQuestion.rangeMax);

    this.ws.cell(1, 1).string(`${this.mf('export.question_type')}: ${this.mf(`export.type.${this._question.TYPE}`)}`);
    this.ws.cell(2, 1).string(this.mf('export.question'));

    this.ws.cell(2, 2).string(this.mf('export.min_range'));
    this.ws.cell(2, 3).string(this.mf('export.correct_value'));
    this.ws.cell(2, 4).string(this.mf('export.max_range'));

    this.ws.cell(4, 1).string(castedQuestion.questionText.replace(/[#]*[*]*/g, ''));
    this.ws.cell(4, 2).number(castedQuestion.rangeMin);
    this.ws.cell(4, 3).number(castedQuestion.correctValue);
    this.ws.cell(4, 4).number(castedQuestion.rangeMax);

    this.ws.cell(6, 1).string(`${this.mf('export.number_of_answers')}:`);
    this.ws.cell(6, 2).number(numberOfInputValuesPerGroup.minRange);
    this.ws.cell(6, 3).number(numberOfInputValuesPerGroup.correctValue);
    this.ws.cell(6, 4).number(numberOfInputValuesPerGroup.maxRange);

    this.ws.cell(7, 1).string(this.mf('export.percent_correct') + ':');
    const correctResponsesPercentage: number = leaderBoardData.map(leaderboard => leaderboard.correctQuestions)
                                               .filter(correctQuestions => correctQuestions.includes(this._questionIndex)).length / (
                                                 await MemberDAO.getMembersOfQuiz(this.quiz.name)
                                               ).length * 100;
    this.ws.cell(7, 2).number((
      isNaN(correctResponsesPercentage) ? 0 : Math.round(correctResponsesPercentage)
    ));

    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(8, 1).string(this.mf('export.average_confidence') + ':');
      let confidenceSummary = 0;
      (
        await MemberDAO.getMembersOfQuiz(this.quiz.name)
      ).forEach((nickItem) => {
        confidenceSummary += nickItem.responses[this._questionIndex].confidence;
      });
      this.ws.cell(8, 2).number(Math.round(confidenceSummary / this.responsesWithConfidenceValue.length));
    }

    let nextColumnIndex = 1;
    this.ws.cell(10, nextColumnIndex++).string(this.mf('export.attendee'));
    if (this._isCasRequired) {
      this.ws.cell(10, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(10, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }
    this.ws.cell(10, nextColumnIndex++).string(this.mf('export.answer'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(10, nextColumnIndex++).string(this.mf('export.confidence_level'));
    }
    this.ws.cell(10, nextColumnIndex++).string(this.mf('export.time'));

    let nextStartRow = 10;
    await asyncForEach(leaderBoardData, async leaderboardItem => {
      const responseItem = (
        await MemberDAO.getMembersOfQuiz(this.quiz.name)
      ).filter(nickitem => {
        return nickitem.name === leaderboardItem.name;
      })[0].responses[this._questionIndex];

      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(leaderboardItem.name);
      if (this._isCasRequired) {
        const profile = (
          await MemberDAO.getMembersOfQuiz(this.quiz.name)
        ).filter((nick: MemberModelItem) => {
          return nick.name === leaderboardItem.name;
        })[0].casProfile;
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.mail[0]);
      }
      this.ws.cell(nextStartRow, nextColumnIndex++).number(parseInt(responseItem.value as string, 10));
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(Math.round(leaderboardItem.confidenceValue));
      }
      this.ws.cell(nextStartRow, nextColumnIndex++).number(leaderboardItem.responseTime);
    });

    if (nextStartRow === 10) {
      this.ws.cell(11, 1).string(this.mf('export.attendee_complete_correct_none_available'));
    }
  }
}
