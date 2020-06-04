import { HistogramBarChart } from './histogramBarChart';

export class Histogram {
  public static async getHistogramData(): Promise<void> {
    // TODO
  }

  public static async renderHistogramSVG(quizName: string, questionIndex: number, histogramType: string = 'bar'): Promise<string> {
    // TODO
    return HistogramBarChart.renderSVG();
  }
}
