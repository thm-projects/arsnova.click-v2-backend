import * as xlsx from 'excel4node';
import * as http from 'http';
import * as MessageFormat from 'messageformat';
import { QuestionType } from '../enums/QuestionType';
import { IExcelWorkbook, IExcelWorksheet } from '../interfaces/iExcel';
import { IQuizEntity } from '../interfaces/quizzes/IQuizEntity';
import { FreeTextExcelWorksheet } from './FreeTextExcelWorksheet';

import { ExcelTheme } from './lib/excel_default_styles';
import { MultipleChoiceExcelWorksheet } from './MultipleChoiceExcelWorksheet';
import { RangedExcelWorksheet } from './RangedExcelWorksheet';
import { SingleChoiceExcelWorksheet } from './SingleChoiceExcelWorksheet';
import { SummaryExcelWorksheet } from './SummaryExcelWorksheet';
import { SurveyExcelWorksheet } from './SurveyExcelWorksheet';

export class ExcelWorkbook implements IExcelWorkbook {
  get theme(): ExcelTheme {
    return this._theme;
  }

  protected _worksheets: Array<IExcelWorksheet> = [];
  private readonly _wb: xlsx.Workbook;
  private readonly _theme: ExcelTheme;
  private readonly _translation: string;
  private readonly _mf: MessageFormat;
  private readonly _quiz: IQuizEntity;

  constructor({ themeName, quiz, translation, mf }: { themeName: string, quiz: IQuizEntity, translation: string, mf: MessageFormat }) {
    this._wb = new xlsx.Workbook({
      jszip: {
        compression: 'DEFLATE',
      },
      defaultFont: {
        size: 12,
        name: 'Calibri',
        color: 'FF000000',
      },
      dateFormat: 'd.m.yyyy',
    });
    this._theme = new ExcelTheme(themeName);
    this._translation = translation;
    this._mf = mf;
    this._quiz = quiz;

    this.generateSheets();
  }

  public write(name: string, handler?: http.ServerResponse | Function): void {
    return this._wb.write(name, handler);
  }

  public writeToBuffer(): Promise<Buffer> {
    return this._wb.writeToBuffer();
  }

  private generateSheets(): void {
    const worksheetOptions: any = {
      wb: this._wb,
      theme: this._theme,
      translation: this._translation,
      quiz: this._quiz,
      mf: this._mf,
    };

    this._worksheets.push(new SummaryExcelWorksheet(worksheetOptions));

    for (let i = 0; i < this._quiz.questionList.length; i++) {
      worksheetOptions.questionIndex = i;
      switch (this._quiz.questionList[i].TYPE) {
        case QuestionType.SingleChoiceQuestion:
        case QuestionType.YesNoSingleChoiceQuestion:
        case QuestionType.TrueFalseSingleChoiceQuestion:
        case QuestionType.ABCDSingleChoiceQuestion:
          this._worksheets.push(new SingleChoiceExcelWorksheet(worksheetOptions));
          break;
        case QuestionType.MultipleChoiceQuestion:
          this._worksheets.push(new MultipleChoiceExcelWorksheet(worksheetOptions));
          break;
        case QuestionType.RangedQuestion:
          this._worksheets.push(new RangedExcelWorksheet(worksheetOptions));
          break;
        case QuestionType.SurveyQuestion:
          this._worksheets.push(new SurveyExcelWorksheet(worksheetOptions));
          break;
        case QuestionType.FreeTextQuestion:
          this._worksheets.push(new FreeTextExcelWorksheet(worksheetOptions));
          break;
        default:
          throw new Error(`Unsupported question type '${this._quiz.questionList[i].TYPE}' while exporting`);
      }
    }
  }
}
