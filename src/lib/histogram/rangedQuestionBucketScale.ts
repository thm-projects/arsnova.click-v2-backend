import { IHistData } from '../../interfaces/IHistData';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';

export class RangedQuestionBucketScale {
  private bucketMap: Array<number> = [];
  private buckets: Array<IHistData> = [];
  private answerCount = 0;
  private min: number;
  private max: number;

  constructor(question: IQuestionRanged) {
    const min = this.min = question.rangeMin;
    const max = this.max = question.rangeMax;
    const hit = question.correctValue;

    const width = max - min + 1;
    const scale = Math.ceil(width / 20);

    const firstBucketRightBorder = Math.min(min + ((hit - min - 1) % scale), hit - 1);
    const lastBucketLeftBorder = Math.max(max - ((max - hit - 1) % scale), hit + 1);

    let bucketIndex = 0;
    let valIndex = min;

    this.buckets[bucketIndex] = this.getEmptyBucket(`< ${firstBucketRightBorder + 1}`);

    for (valIndex; valIndex <= max; valIndex++) {
      if (valIndex < hit && (hit - valIndex) % scale === 0 && valIndex > min) {
        bucketIndex++;
        this.buckets[bucketIndex] = this.getEmptyBucket(scale > 1 ? `${valIndex} - ${valIndex + scale - 1}` : valIndex.toString());
      } else if (valIndex === hit) {
        bucketIndex++;
        this.buckets[bucketIndex] = this.getEmptyBucket(valIndex.toString(), true);
      } else if (valIndex === lastBucketLeftBorder) {
        bucketIndex++;
        this.buckets[bucketIndex] = this.getEmptyBucket(`> ${lastBucketLeftBorder - 1}`);
      } else if (valIndex > hit && (valIndex - hit - 1) % scale === 0) {
        bucketIndex++;
        this.buckets[bucketIndex] = this.getEmptyBucket(scale > 1 ? `${valIndex} - ${valIndex + scale - 1}` : valIndex.toString());
      }

      this.bucketMap[valIndex] = bucketIndex;
    }

  }

  public addValue(val: number): void {
    this.answerCount++;
    this.buckets[this.bucketMap[Math.min(Math.max(val, this.min), this.max)]].val++;
  }

  public calculatePercentages(): void {
    this.buckets.forEach(bucket => bucket.percentage = bucket.val / this.answerCount);
  }

  public getBuckets(): Array<IHistData> {
    return this.buckets;
  }

  private getEmptyBucket(bucketLabel: string, correctValue: boolean = false): IHistData {
    return {
      key: bucketLabel,
      val: 0,
      percentage: null,
      correctValue: correctValue
    };
  }
}
