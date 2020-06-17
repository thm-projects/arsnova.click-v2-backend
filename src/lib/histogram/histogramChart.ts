import * as D3Node from 'd3-node';
import * as d3 from 'd3';
import { IHistData } from '../../interfaces/IHistData';

export abstract class HistogramChart {

  private d3n: D3Node;
  private width = 960;
  private height = 500;
  private margin = {
    top: 10,
    right: 30,
    bottom: 30,
    left: 30
  };

  protected svg: D3Node;
  protected innerWidth: number;
  protected innerHeight: number;

  protected constructor(styles: string) {
    const options = {
      styles: styles,
      d3Module: d3
    };

    this.d3n = new D3Node(options);

    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this.svg = this.d3n.createSVG()
      .attr('viewBox', `0, 0, ${this.width}, ${this.height}`)
      .append('g')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
  }

  public toSVG(): string {
    return this.d3n.svgString();
  }

  public abstract renderData(data: Array<IHistData>): HistogramChart;

}
