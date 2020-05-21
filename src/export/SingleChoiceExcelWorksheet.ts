import MemberDAO from '../db/MemberDAO';
import { IAnswer } from '../interfaces/answeroptions/IAnswerEntity';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionChoice } from '../interfaces/questions/IQuestionChoice';
import { ICasData } from '../interfaces/users/ICasData';
import { asyncForEach } from '../lib/async-for-each';
import { MemberModelItem } from '../models/member/MemberModel';
import { ExcelWorksheet } from './ExcelWorksheet';
import { calculateNumberOfAnswers } from './lib/excel_function_library';

export class SingleChoiceExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;
  private _question: IQuestionChoice;
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
    this._question = this.quiz.questionList[questionIndex] as IQuestionChoice;

    this.loaded.on('load', () => Promise.all([
      this.formatSheet(), this.addSheetData(),
    ]).then(() => this.renderingFinished.emit('done')));
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();
    const answerCellStyle: any = {
      alignment: {
        wrapText: true,
        horizontal: 'center',
        vertical: 'center',
      },
      font: {
        color: 'FFFFFFFF',
      },
    };
    let minColums = 3;
    if (this.responsesWithConfidenceValue.length > 0) {
      minColums++;
    }
    if (this._isCasRequired) {
      minColums += 2;
    }
    const answerList = this._question.answerOptionList;
    const columnsToFormat: number = answerList.length + 1 < minColums ? minColums : answerList.length + 1;

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
    this.ws.cell(6, 2, nextRowIndex, columnsToFormat).style({
      alignment: {
        horizontal: 'center',
      },
    });
    nextRowIndex += 3;

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

    const responses = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).map(nickname => nickname.responses[this._questionIndex]);
    const hasEntries: boolean = responses.length > 0;
    const attendeeEntryRows: number = hasEntries ? (responses.length) : 1;
    const attendeeEntryRowStyle: any = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        horizontal: 'center',
      },
    });
    nextRowIndex++;
    this.ws.cell(nextRowIndex, 1, attendeeEntryRows + nextRowIndex - 1, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    responses.forEach((responseItem, indexInList): void => {
      let nextColumnIndex = 2;
      const targetRow: number = indexInList + nextRowIndex;
      if (this._isCasRequired) {
        nextColumnIndex += 2;
      }
      const responseValue = <number>responseItem.value[0];
      let correctIndex = -1;
      this._question.answerOptionList.forEach((answer, index) => answer.isCorrect ? correctIndex = index : null);
      const isAnswerCorrect = responseValue > -1 && responseValue === correctIndex;
      this.ws.cell(targetRow, nextColumnIndex++).style({
        font: {
          color: 'FFFFFFFF',
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: isAnswerCorrect ? 'FF008000' : 'FFB22222',
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
    this.ws.cell(6, 1).string(this.mf('export.number_of_answers') + ':');

    this.ws.cell(7, 1).string(this.mf('export.percent_correct') + ':');
    const correctResponsesPercentage: number = (await this.getLeaderboardData()).map(leaderboard => leaderboard.correctQuestions)
                                               .filter(correctQuestions => correctQuestions.includes(this._questionIndex)).length
                                               / (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).length * 100;
    this.ws.cell(7, 2).number((isNaN(correctResponsesPercentage) ? 0 : Math.round(correctResponsesPercentage)));

    this.ws.cell(8, 1).string(this.mf('export.required_for_token') + ':');
    this.ws.cell(8, 2).string(this.mf('global.' + (this._question.requiredForToken ? 'yes' : 'no')));

    let nextRowIndex = 9;
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(nextRowIndex, 1).string(this.mf('export.average_confidence') + ':');
      let confidenceSummary = 0;
      (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).forEach((nickItem) => {
        confidenceSummary += nickItem.responses[this._questionIndex].confidence;
      });
      this.ws.cell(nextRowIndex++, 2).number(Math.round(confidenceSummary / this.responsesWithConfidenceValue.length));
    } else {
      nextRowIndex++;
    }
    nextRowIndex += 2;

    let nextColumnIndex = 1;
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
    await asyncForEach(allResponses, async responseItem => {
      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(responseItem.name);
      if (this._isCasRequired) {
        const profile: ICasData = (await MemberDAO.getMembersOfQuizForOwner(this.quiz.name)).filter(
          nickname => nickname.name === responseItem.name)[0].casProfile;
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(nextStartRow, nextColumnIndex++).string(Array.isArray(profile.mail) ? profile.mail.slice(-1)[0] : profile.mail);
      }
      const chosenAnswer: IAnswer = this._question.answerOptionList[responseItem.responses[this._questionIndex].value[0]];
      this.ws.cell(nextStartRow, nextColumnIndex++).string(chosenAnswer ? chosenAnswer.answerText : '');
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

    if (nextStartRow === nextRowIndex) {
      this.ws.cell(nextRowIndex + 1, 1).string(this.mf('export.attendee_complete_correct_none_available'));
    }
  }
}
