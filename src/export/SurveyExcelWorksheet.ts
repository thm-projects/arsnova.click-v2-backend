import MemberDAO from '../db/MemberDAO';
import { IExcelWorksheet } from '../interfaces/iExcel';
import { IQuestionSurvey } from '../interfaces/questions/IQuestionSurvey';
import { ExcelWorksheet } from './ExcelWorksheet';
import { calculateNumberOfAnswers } from './lib/excel_function_library';

export class SurveyExcelWorksheet extends ExcelWorksheet implements IExcelWorksheet {
  private _isCasRequired = this.quiz.sessionConfig.nicks.restrictToCasLogin;
  private _question: IQuestionSurvey;
  private readonly _questionIndex: number;

  constructor({ wb, theme, translation, quiz, mf, questionIndex }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex,
    });
    this._ws = wb.addWorksheet(`${this.mf('export.question')} ${questionIndex + 1}`, this._options);
    this._questionIndex = questionIndex;
    this._question = this.quiz.questionList[questionIndex] as IQuestionSurvey;
    this.formatSheet();
    this.addSheetData();
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();
    const answerList = this._question.answerOptionList;
    let minColums = 3;

    if (this.responsesWithConfidenceValue.length > 0) {
      minColums++;
    }
    if (this._isCasRequired) {
      minColums += 2;
    }
    const columnsToFormat = answerList.length + 1 < minColums ? minColums : answerList.length + 1;
    const answerCellStyle = {
      alignment: {
        wrapText: true,
        horizontal: 'center',
        vertical: 'center',
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
    this.ws.cell(4, 1, 4, columnsToFormat).style(Object.assign({}, answerCellStyle));

    this.ws.cell(6, 1, this.responsesWithConfidenceValue.length > 0 ? 7 : 6, columnsToFormat).style(defaultStyles.statisticsRowStyle);
    this.ws.cell(6, 2, this.responsesWithConfidenceValue.length > 0 ? 7 : 6, columnsToFormat).style({
      alignment: {
        horizontal: 'center',
      },
    });
    this.ws.cell(9, 1, 9, columnsToFormat).style(defaultStyles.attendeeHeaderRowStyle);
    this.ws.cell(9, 1).style({
      alignment: {
        horizontal: 'left',
      },
    });

    this.ws.row(9).filter({
      firstRow: 9,
      firstColumn: 1,
      lastRow: 9,
      lastColumn: minColums,
    });

    const hasEntries = (await MemberDAO.getMembersOfQuiz(this.quiz.name)).length > 0;
    const attendeeEntryRows = hasEntries ? ((await MemberDAO.getMembersOfQuiz(this.quiz.name)).length) : 1;
    const attendeeEntryRowStyle = hasEntries ? defaultStyles.attendeeEntryRowStyle : Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        horizontal: 'center',
      },
    });
    this.ws.cell(10, 1, attendeeEntryRows + 9, columnsToFormat, !hasEntries).style(attendeeEntryRowStyle);

    (await MemberDAO.getMembersOfQuiz(this.quiz.name)).forEach((responseItem, indexInList) => {
      let nextColumnIndex = 3;
      const targetRow = indexInList + 10;
      if (this._isCasRequired) {
        nextColumnIndex += 2;
      }
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
    const answerList = this._question.answerOptionList;

    /*
     * Will translate the questions type name
     * - export.type.SurveyQuestion,
     * - export.type.TrueFalseSingleChoiceQuestion,
     * - export.type.YesNoSingleChoiceQuestion,
     * - export.type.ABCDSingleChoiceQuestion,
     * - export.type.SingleChoiceQuestion,
     * - export.type.RangedQuestion,
     * - export.type.FreeTextQuestion,
     * - export.type.MultipleChoiceQuestion,
     */
    this.ws.cell(1, 1).string(`${this.mf('export.question_type')}: ${this.mf(`export.type.${this._question.TYPE}`)}`);
    this.ws.cell(2, 1).string(this.mf('export.question'));

    this.ws.cell(4, 1).string(this._question.questionText.replace(/[#]*[*]*/g, ''));
    for (let j = 0; j < answerList.length; j++) {
      this.ws.cell(2, (j + 2)).string(this.mf('export.answer') + ' ' + (j + 1));
      this.ws.cell(4, (j + 2)).string(answerList[j].answerText);
      this.ws.cell(6, (j + 2)).number(calculateNumberOfAnswers(this.quiz, this._questionIndex, j));
    }

    this.ws.cell(6, 1).string(this.mf('export.number_of_answers') + ':');

    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(7, 1).string(this.mf('export.average_confidence') + ':');
      let confidenceSummary = 0;
      (await MemberDAO.getMembersOfQuiz(this.quiz.name)).forEach((nickItem) => {
        confidenceSummary += nickItem.responses[this._questionIndex].confidence;
      });
      this.ws.cell(7, 2).number(Math.round(confidenceSummary / this.responsesWithConfidenceValue.length));
    }

    let nextColumnIndex = 1;
    this.ws.cell(9, nextColumnIndex++).string(this.mf('export.attendee'));
    if (this._isCasRequired) {
      this.ws.cell(9, nextColumnIndex++).string(this.mf('export.cas_account_id'));
      this.ws.cell(9, nextColumnIndex++).string(this.mf('export.cas_account_email'));
    }
    this.ws.cell(9, nextColumnIndex++).string(this.mf('export.answer'));
    if (this.responsesWithConfidenceValue.length > 0) {
      this.ws.cell(9, nextColumnIndex++).string(this.mf('export.confidence_level'));
    }
    this.ws.cell(9, nextColumnIndex++).string(this.mf('export.time'));

    let nextStartRow = 9;
    (await MemberDAO.getMembersOfQuiz(this.quiz.name)).forEach((nickItem, indexInList) => {
      nextColumnIndex = 1;
      nextStartRow++;
      this.ws.cell(nextStartRow, nextColumnIndex++).string(nickItem.name);
      if (this._isCasRequired) {
        const profile = nickItem.casProfile;
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.username[0]);
        this.ws.cell(nextStartRow, nextColumnIndex++).string(profile.mail[0]);
      }
      const chosenAnswer: Array<string> = (<Array<any>>nickItem.responses[this._questionIndex].value).map(
        answerIndex => this._question.answerOptionList[parseInt(answerIndex, 10)].answerText);
      this.ws.cell(nextStartRow, nextColumnIndex++).string(chosenAnswer.join(', '));
      if (this.responsesWithConfidenceValue.length > 0) {
        this.ws.cell(nextStartRow, nextColumnIndex++).number(Math.round(nickItem.responses[this._questionIndex].confidence));
      }
      this.ws.cell(nextStartRow, nextColumnIndex++).number(nickItem.responses[this._questionIndex].responseTime);
    });
    if (nextStartRow === 9) {
      this.ws.cell(10, 1).string(this.mf('export.attendee_complete_correct_none_available'));
    }
  }
}
