import { AbstractDAO } from './AbstractDAO';

class MathjaxDAO extends AbstractDAO {
  private _storage: object = {};

  get storage(): object {
    return this._storage;
  }

  public static getInstance(): MathjaxDAO {
    if (!this.instance) {
      this.instance = new MathjaxDAO();
    }
    return this.instance;
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    return {};
  }

  public getAllPreviouslyRenderedData(plainData: string): object {
    return this.storage[plainData];
  }

  public updateRenderedData(renderedData, plainData): void {
    this.storage[plainData] = renderedData;
  }
}

export default MathjaxDAO.getInstance();
