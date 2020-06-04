import { AbstractDAO } from './AbstractDAO';

class HistogramDAO extends AbstractDAO {
  private _storage: object = {};

  get storage(): object {
    return this._storage;
  }

  public static getInstance(): HistogramDAO {
    if (!this.instance) {
      this.instance = new HistogramDAO();
    }
    return this.instance;
  }

  public getAllPreviouslyRenderedData(quizName: string, questionIndex: number): object {
    return this.storage[quizName][questionIndex];
  }

  public updateRenderedData(renderedData, quizName: string, questionIndex: number): void {
    this.storage[quizName][questionIndex] = renderedData;
  }

  public async getStatistics(): Promise<{ [p: string]: number }> {
    return Promise.resolve({});
  }
}

export default HistogramDAO.getInstance();
