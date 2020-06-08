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

    const margin = {top: 10, right: 30, bottom: 30, left: 30};
    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;

    const svg = d3n.createSVG()
      .attr('viewBox', `0, 0, ${svgWidth}, ${svgHeight}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    return d3n.svgString();
  }
}
