import { IHistData } from '../../interfaces/IHistData';
import { HistogramChart } from './histogramChart';

export class HistogramDonutChart extends HistogramChart {

  constructor() {
    const styles = '';
    super(styles);
  }

  public renderData(data: Array<IHistData>): HistogramChart {
    return this;
  }

}
