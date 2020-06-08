import { DiagramType } from '../../enums/DiagramType';
import { IHistData } from '../../interfaces/IHistData';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { HistogramBarChart } from './histogramBarChart';
import { HistogramConverter } from './histogramConverter';
import { HistogramPieChart } from './histogramPieChart';

export class Histogram {
  public static getHistogramData(
    responsesRaw: Array<IQuizResponse>,
    questionData: IQuestion
  ): Array<IHistData> {
    console.log(questionData);
    return HistogramConverter[`convert${questionData.TYPE}`](questionData, responsesRaw);
  }

  public static renderHistogramSVG(
    responsesRaw: Array<IQuizResponse>,
    questionData: IQuestion,
    diagramType: DiagramType = DiagramType.Bar
  ): string {

    const histData = this.getHistogramData(responsesRaw, questionData);

    switch (diagramType) {
      case DiagramType.Bar:
        return HistogramBarChart.renderSVG(histData);
      case DiagramType.Pie:
        return HistogramPieChart.renderSVG(histData);
    }

    return null;
  }

}
