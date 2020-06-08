import { DiagramType } from '../../enums/DiagramType';
import { HistogramBarChart } from './histogramBarChart';

export class Histogram {
  public static async getHistogramData(responsesRaw: object, questionData: object): Promise<void> {
    // TODO
  }

  public static async renderHistogramSVG(responsesRaw: object, questionData: object, histogramType: string = DiagramType.Bar): Promise<string> {
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
