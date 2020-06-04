import * as D3Node from 'd3-node';
import * as d3 from 'd3';

export class HistogramPieChart {

  public static renderSVG(data): string {
    const styles = `.bar rect { fill: black; } .bar text { fill: #fff; font: 10px sans-serif; }`;

    const options = {
      svgStyles: styles,
      d3Module: d3
    };

    const d3n = new D3Node(options);

    data = d3.range(1000).map(d3.randomBates(10));

    const margin = {top: 10, right: 30, bottom: 30, left: 30};
    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .rangeRound([0, width]);

    const bins = d3.histogram()
      .domain(x.domain())
      .thresholds(x.ticks(20))(data);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, function (d): number { return d.length; })])
      .range([height, 0]);

    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;

    const svg = d3n.createSVG(svgWidth, svgHeight)
      .attr('viewBox', '0, 0, ' + svgWidth + ', ' + svgHeight)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    const bar = svg.selectAll('.bar')
      .data(bins)
      .enter().append('g')
      .attr('class', 'bar')
      .attr('transform', function (d): string { return 'translate(' + x(d.x0) + ',' + y(d.length) + ')'; });

    bar.append('rect')
      .attr('x', 1)
      .attr('width', x(bins[0].x1) - x(bins[0].x0) - 1)
      .attr('height', function (d): number { return height - y(d.length); });

    bar.append('text')
      .attr('dy', '.75em')
      .attr('y', 6)
      .attr('x', (x(bins[0].x1) - x(bins[0].x0)) / 2)
      .attr('text-anchor', 'middle')
      .text(function (d): string { return d.length > 0 ? d.length : ''; });

    svg.append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x));

    return d3n.svgString();
  }
}
