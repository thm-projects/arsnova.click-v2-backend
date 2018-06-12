import { IActiveQuiz } from 'arsnova-click-v2-types/src/common';
import { IExcelWorkbook, IExcelWorksheet } from 'arsnova-click-v2-types/src/excel.interfaces';
import * as xlsx from 'excel4node';
import { Response } from 'express';
import * as MessageFormat from 'messageformat';
import { MultipleChoiceExcelWorksheet } from './excel-worksheet-choice-multiple';
import { SingleChoiceExcelWorksheet } from './excel-worksheet-choice-single';
import { FreeTextExcelWorksheet } from './excel-worksheet-freetext';
import { RangedExcelWorksheet } from './excel-worksheet-ranged';
import { SummaryExcelWorksheet } from './excel-worksheet-summary';
import { SurveyExcelWorksheet } from './excel-worksheet-survey';

import { ExcelTheme } from './lib/excel_default_styles';

export class ExcelWorkbook implements IExcelWorkbook {
  get theme(): ExcelTheme {
    return this._theme;
  }

  protected _worksheets: Array<IExcelWorksheet> = [];
  private readonly _wb: xlsx.Workbook;
  private readonly _theme: ExcelTheme;
  private readonly _translation: string;
  private readonly _mf: MessageFormat;
  private readonly _quiz: IActiveQuiz;

  constructor({ themeName, quiz, translation, mf }: { themeName: string, quiz: IActiveQuiz, translation: string, mf: MessageFormat }) {
    this._wb = new xlsx.Workbook({
      jszip: {
        compression: 'DEFLATE',
      }, defaultFont: {
        size: 12, name: 'Calibri', color: 'FF000000',
      }, dateFormat: 'd.m.yyyy',
    });
    this._theme = new ExcelTheme(themeName);
    this._translation = translation;
    this._mf = mf;
    this._quiz = quiz;

    this.generateSheets();
  }

  public write(name: string, handler?: Response | Function): void {
    this._wb.write(name, handler);
  }

  public writeToBuffer(): any {
    return this._wb.writeToBuffer();
  }

  private generateSheets(): void {
    const worksheetOptions: any = {
      wb: this._wb, theme: this._theme, translation: this._translation, quiz: this._quiz, mf: this._mf,
    };

    this._worksheets.push(new SummaryExcelWorksheet(worksheetOptions));

    for (let i = 0; i < this._quiz.originalObject.questionList.length; i++) {
      worksheetOptions.questionIndex = i;
      switch (this._quiz.originalObject.questionList[i].TYPE) {
        case 'SingleChoiceQuestion':
        case 'YesNoSingleChoiceQuestion':
        case 'TrueFalseSingleChoiceQuestion':
        case 'ABCDSingleChoiceQuestion':
          this._worksheets.push(new SingleChoiceExcelWorksheet(worksheetOptions));
          break;
        case 'MultipleChoiceQuestion':
          this._worksheets.push(new MultipleChoiceExcelWorksheet(worksheetOptions));
          break;
        case 'RangedQuestion':
          this._worksheets.push(new RangedExcelWorksheet(worksheetOptions));
          break;
        case 'SurveyQuestion':
          this._worksheets.push(new SurveyExcelWorksheet(worksheetOptions));
          break;
        case 'FreeTextQuestion':
          this._worksheets.push(new FreeTextExcelWorksheet(worksheetOptions));
          break;
        default:
          throw new Error(`Unsupported question type '${this._quiz.originalObject.questionList[i].TYPE}' while exporting`);
      }
    }
  }
}
