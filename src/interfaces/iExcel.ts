import EventEmitter = NodeJS.EventEmitter;

export declare interface IExcelTheme {
  getStyles(): any;
}

export declare interface IExcelWorkbook {
  theme: IExcelTheme;
}

export declare interface IExcelWorksheet {
  renderingFinished: EventEmitter;

  formatSheet(): void;

  addSheetData(): void;
}
