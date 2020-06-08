import { DiagramType } from '../enums/DiagramType';
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

  public getPreviouslyRenderedData(quizName: string, questionIndex: number, diagramType: string = DiagramType.Bar): string {
    return this.storage?.[quizName]?.[questionIndex]?.[diagramType] ?? null;
  }

  public updateRenderedData(renderedData, quizName: string, questionIndex: number, diagramType: string = DiagramType.Bar): void {
    if (!this.storage[quizName]) { this.storage[quizName] = {}; }
    if (!this.storage[quizName][questionIndex]) { this.storage[quizName][questionIndex] = {}; }
    if (!this.storage[quizName][questionIndex][diagramType]) { this.storage[quizName][questionIndex][diagramType] = {}; }
    this.storage[quizName][questionIndex][diagramType] = renderedData;
  }

  public async getStatistics(): Promise<{ [p: string]: number }> {
    return Promise.resolve({});
  }
}

export default HistogramDAO.getInstance();
