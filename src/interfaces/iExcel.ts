export declare interface IExcelTheme {
  getStyles(): any;
}

export declare interface IExcelWorkbook {
  theme: IExcelTheme;
}

export declare interface IExcelWorksheet {
  formatSheet(): void;

  addSheetData(): void;
}
