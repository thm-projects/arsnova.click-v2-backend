import MemberDAO from '../db/MemberDAO';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionRanged } from '../interfaces/questions/IQuestionRanged';
import { asyncForEach } from '../lib/async-for-each';
import { ExcelWorksheet } from './ExcelWorksheet';
import { calculateNumberOfRangedAnswers } from './lib/excel_function_library';

export class RangedExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private readonly _question: IQuestionRanged;
  private readonly _questionIndex: number;

  constructor({ wb, theme, translation, quiz, mf, questionIndex, leaderboard, leaderboardGroup }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex,
      leaderboard,
      leaderboardGroup
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

    let nextRowIndex = this.responsesWithConfidenceValue.length > 0 ? 9 : 8;
    const rowStyle = {...defaultStyles.statisticsRowInnerStyle, ...{
        alignment: {
          horizontal: 'center',
        },
      }};
    this.ws.cell(6, 1, nextRowIndex, columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(6, 2, nextRowIndex++, 2).style(rowStyle);
    this.ws.cell(6, 3).style(rowStyle);
    this.ws.cell(6, 4).style(rowStyle);

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
      lastRow: nextRowIndex,
      lastColumn: minColums,
    });

    const hasEntries = this.leaderboard.length > 0;
    const attendeeEntryRows = hasEntries ? (
      this.leaderboard.length
    ) : 1;
    const attendeeEntryRowStyle = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        horizontal: 'center',
      },
    });
    nextRowIndex++;
    this.ws.cell(nextRowIndex, 1, attendeeEntryRows + nextRowIndex - 1, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    await asyncForEach(this.leaderboard, async (leaderboardItem, indexInList) => {
      let nextColumnIndex = 2;
      const targetRow = indexInList + nextRowIndex;

      const responseItem = (
        await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)
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
        numberFormat: defaultStyles.numberFormat,
      });
    });
  }

  public async addSheetData(): Promise<void> {
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

    let nextRowIndex = 6;
    this.ws.cell(nextRowIndex, 1).string(`${this.mf('export.number_of_answers')}:`);
    this.ws.cell(nextRowIndex, 2).number(numberOfInputValuesPerGroup.minRange);
    this.ws.cell(nextRowIndex, 3).number(numberOfInputValuesPerGroup.correctValue);
    this.ws.cell(nextRowIndex++, 4).number(numberOfInputValuesPerGroup.maxRange);

    this.ws.cell(nextRowIndex, 1).string(this.mf('export.percent_correct') + ':');
    const correctResponsesPercentage: number = this.leaderboard.map(leaderboard => leaderboard.correctQuestions)
                                               .filter(correctQuestions => correctQuestions.includes(this._questionIndex)).length / (
                                                 await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)
                                               ).length * 100;
    this.ws.cell(nextRowIndex++, 2).number((
      isNaN(correctResponsesPercentage) ? 0 : Math.round(correctResponsesPercentage)
    ));

    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextRowIndex, 1).string(this.mf('export.average_confidence') + ':');
      let confidenceSummary = 0;
      (
        await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)
      ).forEach((nickItem) => {
        confidenceSummary += nickItem.responses[this._questionIndex].confidence;
      });
      this.ws.cell(nextRowIndex++, 2).number(Math.round(confidenceSummary / this.responsesWithConfidenceValue.length));
    }

    this.ws.cell(nextRowIndex, 1).string(this.mf('export.required_for_token') + ':');
    this.ws.cell(nextRowIndex++, 2).string(this.mf('global.' + (this._question.requiredForToken ? 'yes' : 'no')));

    let nextColumnIndex = 1;
    nextRowIndex += 2;

    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.attendee'));

    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.answer'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.confidence_level'));
    }
    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.time'));

    let nextStartRow = nextRowIndex;
    await asyncForEach(this.leaderboard, async leaderboardItem => {
      const responseItem = (
        await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)
      ).filter(nickitem => {
        return nickitem.name === leaderboardItem.name;
      })[0].responses[this._questionIndex];

      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(leaderboardItem.name);

      const value = parseInt(responseItem.value as string, 10);
      if (isNaN(value)) {
        this.ws.cell(nextStartRow, nextColumnIndex++).string(responseItem.value);
      } else {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(value);
      }
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(Math.round(leaderboardItem.confidenceValue));
      }
      const responseTime = this.formatMillisToSeconds(leaderboardItem.responseTime);
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
