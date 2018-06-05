export class MathjaxDAO {
  private static readonly mathjaxCache: Object = {};

  public static createDump(): {} {
    return MathjaxDAO.mathjaxCache;
  }

  public static getAllPreviouslyRenderedData(plainData: string): Object {
    return MathjaxDAO.mathjaxCache[plainData];
  }

  public static updateRenderedData(renderedData, plainData): void {
    MathjaxDAO.mathjaxCache[plainData] = renderedData;
  }

}
