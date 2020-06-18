import * as d3 from 'd3';
import { IHistData } from '../../interfaces/IHistData';
import { HistogramChart } from './histogramChart';

export class HistogramBarChart extends HistogramChart {

  constructor() {
    const styles = '.bar rect { fill: black; } ' +
                   '.bar text { fill: white; font: 10px sans-serif; } ' +
                   '.bar.hit rect { fill: #006000; } ';
    super(styles);
  }

  public renderData(data: Array<IHistData>): HistogramChart {
    const x = d3.scaleBand().range([0, this.innerWidth]).padding(0.2);
    const y = d3.scaleLinear().range([this.innerHeight, 0]);

    x.domain(data.map(d => d.key));
    y.domain([0, Math.floor((d3.max(data, d => d.percentage) * 10) + 1) / 10]);

    this.svg.append('g')
      .attr('transform', `translate(0, ${this.innerHeight})`)
      .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', d => 'rotate(-45)');

    this.svg.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `${Math.round(d * 100)}%`));

    const bar = this.svg.selectAll('.bar')
      .data(data)
      .enter().append('g')
      .attr('class', d => d.correctValue ? 'bar hit' : 'bar')
      .attr('transform', d => `translate(0, ${y(d.percentage)})`);

    bar.append('rect')
      .attr('x', d => x(d.key))
      .attr('width', x.bandwidth())
      .attr('height', d => this.innerHeight - y(d.percentage));

    bar.append('text')
      .attr('dy', '.75em')
      .attr('y', d => this.innerHeight - y(d.percentage) < 25 ? -15 : 6)
      .attr('x', d => x(d.key) + x.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .text(d => d.val > 0 ? d.val : '');

    return this;
  }
}
