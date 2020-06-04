import { HistogramBarChart } from './histogramBarChart';

export class Histogram {
  public static async getHistogramData(): Promise<void> {
    // TODO
  }

  public static async renderHistogramSVG(quizName: string, questionIndex: number, histogramType: string = 'bar'): Promise<string> {
    // TODO
    const dummyData = [
      {
        key: 'A',
        val: 13
      },
      {
        key: 'B',
        val: 9
      },
      {
        key: 'C',
        val: 5
      },
      {
        key: 'D',
        val: 14
      },
    ];

    return HistogramBarChart.renderSVG(dummyData);
  }
}
