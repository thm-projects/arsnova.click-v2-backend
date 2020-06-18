import { IHistData } from '../../interfaces/IHistData';
import { HistogramChart } from './histogramChart';

export class HistogramPieChart extends HistogramChart {

  constructor() {
    super();
  }

  public renderData(data: Array<IHistData>): HistogramChart {
    return this;
  }

}
