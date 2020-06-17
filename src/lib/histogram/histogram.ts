import { DiagramType } from '../../enums/DiagramType';
import { IHistData } from '../../interfaces/IHistData';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { HistogramBarChart } from './histogramBarChart';
import { HistogramChart } from './histogramChart';
import { HistogramConverter } from './histogramConverter';
import { HistogramDonutChart } from './histogramDonutChart';
import { HistogramLineChart } from './histogramLineChart';
import { HistogramPieChart } from './histogramPieChart';

export class Histogram {
  public static getHistogramData(
    responsesRaw: Array<IQuizResponse>,
    questionData: IQuestion
  ): Array<IHistData> {

    return HistogramConverter[`convert${questionData.TYPE}`](questionData, responsesRaw);

  }

  public static renderHistogramSVG(
    responsesRaw: Array<IQuizResponse>,
    questionData: IQuestion,
    diagramType: DiagramType = DiagramType.Bar
  ): string {

    const histData = this.getHistogramData(responsesRaw, questionData);

    let chart: HistogramChart;

    switch (diagramType) {
      case DiagramType.Bar:
        chart = new HistogramBarChart();
        break;
      case DiagramType.Pie:
        chart = new HistogramPieChart();
        break;
      case DiagramType.Line:
        chart = new HistogramLineChart();
        break;
      case DiagramType.Donut:
        chart = new HistogramDonutChart();
        break;
      default:
        return null;
    }

    return chart.renderData(histData).toSVG();
  }

}
