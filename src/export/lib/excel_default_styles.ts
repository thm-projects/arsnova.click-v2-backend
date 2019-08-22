import * as fs from 'fs';
import * as path from 'path';
import { staticStatistics } from '../../statistics';

const themeData = JSON.parse(fs.readFileSync(path.join(staticStatistics.pathToAssets, 'themeData.json')).toString());

export class ExcelTheme {
  private _selectedTheme: string;

  constructor(theme) {
    this._selectedTheme = theme;
  }

  public getStyles(): any {
    // noinspection TypeScriptUnresolvedVariable
    return {
      quizNameRowStyle: {
        alignment: {
          vertical: 'center',
        },
        font: {
          color: themeData[this._selectedTheme].quizNameRowStyle.fg,
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: themeData[this._selectedTheme].quizNameRowStyle.bg,
        },
      },
      exportedAtRowStyle: {
        font: {
          color: themeData[this._selectedTheme].exportedAtRowStyle.fg,
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: themeData[this._selectedTheme].exportedAtRowStyle.bg,
        },
      },
      questionCellStyle: {
        alignment: {
          wrapText: true,
          vertical: 'top',
          horizontal: 'left',
        },
      },
      statisticsRowStyle: {
        font: {
          color: themeData[this._selectedTheme].statisticsRowStyle.fg,
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: themeData[this._selectedTheme].statisticsRowStyle.bg,
        },
      },
      statisticsRowInnerStyle: {},
      attendeeHeaderGroupRowStyle: {
        font: {
          bold: true,
          color: themeData[this._selectedTheme].attendeeHeaderGroupRowStyle.fg,
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: themeData[this._selectedTheme].attendeeHeaderGroupRowStyle.bg,
        },
      },
      attendeeHeaderRowStyle: {
        alignment: {
          wrapText: true,
          horizontal: 'center',
          vertical: 'center',
        },
        font: {
          color: themeData[this._selectedTheme].attendeeHeaderRowStyle.fg,
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: themeData[this._selectedTheme].attendeeHeaderRowStyle.bg,
        },
      },
      attendeeEntryRowStyle: {
        font: {
          color: themeData[this._selectedTheme].attendeeEntryRowStyle.fg,
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: themeData[this._selectedTheme].attendeeEntryRowStyle.bg,
        },
      },
    };
  }
}
