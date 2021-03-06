import MemberDAO from '../db/MemberDAO';
import { IAnswer } from '../interfaces/answeroptions/IAnswerEntity';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionChoice } from '../interfaces/questions/IQuestionChoice';
import { IQuizResponse } from '../interfaces/quizzes/IQuizResponse';
import { asyncForEach } from '../lib/async-for-each';
import { MemberModelItem } from '../models/member/MemberModel';
import { ExcelWorksheet } from './ExcelWorksheet';
import { calculateNumberOfAnswers } from './lib/excel_function_library';

export class MultipleChoiceExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _question: IQuestionChoice;
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
    this._question = this.quiz.questionList[questionIndex] as IQuestionChoice;

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

    const answerList = this._question.answerOptionList;
    const columnsToFormat: number = answerList.length + 1 < minColums ? minColums : answerList.length + 1;
    const answerCellStyle: Object = {
      alignment: {
        wrapText: true,
        horizontal: 'center',
        vertical: 'center',
      },
      font: {
        color: 'FFFFFFFF',
      },
    };

    this.ws.row(1).setHeight(20);
    this.ws.column(1).setWidth(this.responsesWithConfidenceValue.length > 0 ? 40 : 30);
    for (let j = 2; j <= columnsToFormat; j++) {
      this.ws.column(j).setWidth(20);
    }

    this.ws.cell(1, 1, 1, columnsToFormat).style(defaultStyles.quizNameRowStyle);
    this.ws.cell(2, 1, 2, columnsToFormat).style(defaultStyles.exportedAtRowStyle);
    this.ws.cell(2, 2, 2, columnsToFormat).style({
      alignment: {
        horizontal: 'center',
      },
    });

    this.ws.cell(4, 1).style(defaultStyles.questionCellStyle);
    for (let j = 0; j < answerList.length; j++) {
      const targetColumn: number = j + 2;
      this.ws.cell(4, targetColumn).style(Object.assign({}, answerCellStyle, {
        border: {
          right: {
            style: (targetColumn <= answerList.length) ? 'thin' : 'none',
            color: 'black',
          },
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: answerList[j].isCorrect ? 'FF008000' : 'FFB22222',
        },
      }));
    }

    let nextRowIndex = this.responsesWithConfidenceValue.length > 0 ? 9 : 8;
    this.ws.cell(6, 1, nextRowIndex, columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(6, 2, nextRowIndex++, columnsToFormat).style({
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
      lastRow: nextRowIndex,
      lastColumn: minColums,
    });
    nextRowIndex++;

    const responses = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).map(nickname => nickname.responses[this._questionIndex]);
    const hasEntries: boolean = responses.length > 0;
    const attendeeEntryRows: number = hasEntries ? (responses.length) : 1;
    const attendeeEntryRowStyle: Object = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle,
      {
        alignment: {
          horizontal: 'center',
        },
      });
    this.ws.cell(nextRowIndex, 1, attendeeEntryRows + nextRowIndex - 1, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    responses.forEach((responseItem: IQuizResponse, indexInList: number): void => {
      let nextColumnIndex = 3;
      const targetRow: number = indexInList + nextRowIndex;

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
    const answerList = this._question.answerOptionList;
    const allResponses: Array<MemberModelItem> = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).filter(nickname => {
      return nickname.responses.map(response => {
        return !!response.value && response.value !== -1 ? response.value : null;
      });
    });

    this.ws.cell(1, 1).string(`${this.mf('export.question_type')}: ${this.mf(`export.type.${this._question.TYPE}`)}`);
    this.ws.cell(2, 1).string(this.mf('export.question'));
    this.ws.cell(4, 1).string(this._question.questionText.replace(/[#]*[*]*/g, ''));

    for (let j = 0; j < answerList.length; j++) {
      this.ws.cell(2, (j + 2)).string(this.mf('export.answer') + ' ' + (j + 1));
      this.ws.cell(4, (j + 2)).string(answerList[j].answerText);
      this.ws.cell(6, (j + 2)).number(await calculateNumberOfAnswers(this.quiz, this._questionIndex, j));
    }

    let nextRowIndex = 6;
    this.ws.cell(nextRowIndex++, 1).string(this.mf('export.number_of_answers') + ':');
    this.ws.cell(nextRowIndex, 1).string(this.mf('export.percent_correct') + ':');

    const correctResponsesPercentage: number = (this.leaderboard).map(leaderboard => leaderboard.correctQuestions)
                                               .filter(correctQuestions => correctQuestions.includes(this._questionIndex)).length
                                               / (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length * 100;
    this.ws.cell(nextRowIndex++, 2).number((isNaN(correctResponsesPercentage) ? 0 : Math.round(correctResponsesPercentage)));

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

    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.answer'));

    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.confidence_level'));
    }

    this.ws.cell(nextRowIndex, nextColumnIndex++).string(this.mf('export.time'));

    let nextStartRow = nextRowIndex;
    await asyncForEach(allResponses, async responseItem => {
      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(responseItem.name);

      const nickItem = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).filter(nick => nick.name === responseItem.name)[0];
      const chosenAnswer = this._question.answerOptionList.filter((answer, index) => {
        const responseValue = nickItem.responses[this._questionIndex].value;
        if (Array.isArray(responseValue)) {
          return responseValue.indexOf(index) > -1;
        }
        return null;
      });
      const chosenAnswerString: Array<any> = [];
      chosenAnswer.forEach((chosenAnswerItem: IAnswer): void => {
        chosenAnswerString.push({ color: chosenAnswerItem.isCorrect ? 'FF008000' : 'FFB22222' });
        chosenAnswerString.push(chosenAnswerItem.answerText);
        chosenAnswerString.push({ color: 'FF000000' });
        chosenAnswerString.push(', ');
      });
      chosenAnswerString.pop();
      this.ws.cell(nextStartRow, nextColumnIndex++).string(chosenAnswerString);
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(Math.round(responseItem.responses[this._questionIndex].confidence));
      }
      const responseTime = this.formatMillisToSeconds(responseItem.responses[this._questionIndex].responseTime);
      if (responseTime) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(responseTime);
      } else {
        this.ws.cell(nextStartRow, nextColumnIndex++).string(this.mf('export.no_answer'));
      }
    });
    if (nextStartRow === 10) {
      this.ws.cell(11, 1).string(this.mf('export.attendee_complete_correct_none_available'));
    }
  }
}
