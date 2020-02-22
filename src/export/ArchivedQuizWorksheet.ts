import { IExcelWorksheet } from '../interfaces/iExcel';
import { ExcelWorksheet } from './ExcelWorksheet';

declare global {
  namespace xlsx {
    interface IRow {
      filter(config: object): void;

      setHeight(height: number): void;

      setWidth(width: number): void;
    }
  }
}

export class ArchivedQuizWorksheet extends ExcelWorksheet implements IExcelWorksheet {

  constructor({ wb, theme, translation, quiz, mf }) {
    super({
      theme,
      translation,
      quiz,
      mf,
      questionIndex: null,
    });

    this._ws = wb.addWorksheet(mf('export.session_excel_sheet_name'), this._options);

    this.loaded.on('load', () => Promise.all([
      this.formatSheet(), this.addSheetData(),
    ]).then(() => this.renderingFinished.emit('done')));
  }

  public async formatSheet(): Promise<void> {
    const defaultStyles = this._theme.getStyles();

    this.ws.row(1).setHeight(20);
    this.ws.row(2).setHeight(16);
    this.ws.row(3).setHeight(40);
    this.ws.row(4).setHeight(16);
    this.ws.row(5).setHeight(215);
    this.ws.column(1).setWidth(100);

    this.ws.cell(1, 1).style(Object.assign({}, defaultStyles.attendeeHeaderGroupRowStyle, {
      alignment: {
        wrapText: true,
        vertical: 'center',
        horizontal: 'left',
      },
    }));

    this.ws.cell(3, 1).style(Object.assign({}, defaultStyles.attendeeHeaderRowStyle, {
      alignment: {
        wrapText: true,
        vertical: 'center',
        horizontal: 'left',
      },
    }));

    this.ws.cell(5, 1).style(Object.assign({}, defaultStyles.attendeeEntryRowStyle, {
      alignment: {
        wrapText: true,
        vertical: 'center',
        horizontal: 'left',
      },
    }));
  }

  public async addSheetData(): Promise<void> {
    this.ws.cell(1, 1).string(`${this.mf('export.session_content')}`);
    this.ws.cell(3, 1).string(`${this.mf('export.session_content_explanation')}`);
    this.ws.cell(5, 1).string(JSON.stringify(this.quiz));
  }
}
