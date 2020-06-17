import * as d3 from 'd3';
import { IHistData } from '../../interfaces/IHistData';
import { HistogramChart } from './histogramChart';

export class HistogramBarChart extends HistogramChart {

  constructor() {
    const styles = '.bar rect { fill: black; } .bar text { fill: #fff; font: 10px sans-serif; }';
    super(styles);
  }

  public renderData(data: Array<IHistData>): HistogramChart {
    const x = d3.scaleBand().range([0, this.innerWidth]).padding(0.4);
    const y = d3.scaleLinear().range([this.innerHeight, 0]);

    x.domain(data.map(d => d.key));
    y.domain([0, d3.max(data, d => d.val)]);

    this.svg.append('g')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(d3.axisBottom(x));

    this.svg.append('g')
      .call(d3.axisLeft(y).tickFormat(d => d));

    const bar = this.svg.selectAll('.bar')
      .data(data)
      .enter().append('g')
      .attr('class', 'bar')
      .attr('transform', d => `translate(0, ${y(d.val)})`);

    bar.append('rect')
      .attr('x', d => x(d.key))
      .attr('width', x.bandwidth())
      .attr('height', d => this.innerHeight - y(d.val));

    bar.append('text')
      .attr('dy', '.75em')
      .attr('y', d => this.innerHeight - y(d.val) < 25 ? -15 : 6)
      .attr('x', d => x(d.key) + x.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .text(d => d.val > 0 ? d.val : '');

    return this;
  }
}
