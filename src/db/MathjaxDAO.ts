import { AbstractDAO } from './AbstractDAO';

class MathjaxDAO extends AbstractDAO<object> {

  public static getInstance(): MathjaxDAO {
    if (!this.instance) {
      this.instance = new MathjaxDAO({});
    }
    return this.instance;
  }

  public getAllPreviouslyRenderedData(plainData: string): object {
    return this.storage[plainData];
  }

  public updateRenderedData(renderedData, plainData): void {
    this.storage[plainData] = renderedData;
  }
}

export default MathjaxDAO.getInstance();
