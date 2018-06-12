export class MathjaxDAO {
  private static readonly mathjaxCache: object = {};

  public static createDump(): {} {
    return MathjaxDAO.mathjaxCache;
  }

  public static getAllPreviouslyRenderedData(plainData: string): object {
    return MathjaxDAO.mathjaxCache[plainData];
  }

  public static updateRenderedData(renderedData, plainData): void {
    MathjaxDAO.mathjaxCache[plainData] = renderedData;
  }

}
