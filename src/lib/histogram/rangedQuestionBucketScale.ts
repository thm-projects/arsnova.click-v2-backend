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

    if (scale === 1) {
      for (let i = min; i <= max; i++) {
        this.buckets[bucketIndex] = this.getEmptyBucket(i.toString(), i === hit);
        this.bucketMap[i] = bucketIndex;
        bucketIndex++;
      }
      return;
    }

    this.buckets[bucketIndex] = this.getEmptyBucket(`< ${firstBucketRightBorder + 1}`);

    for (valIndex; valIndex < hit; valIndex++) {
      if ((hit - valIndex) % scale === 0 && valIndex > min) {
        bucketIndex++;
        this.buckets[bucketIndex] = this.getEmptyBucket(`${valIndex} - ${valIndex + scale - 1}`);
      }
      this.bucketMap[valIndex] = bucketIndex;
    }

    bucketIndex++;
    this.buckets[bucketIndex] = this.getEmptyBucket(valIndex.toString(), true);
    this.bucketMap[valIndex] = bucketIndex;
    valIndex++;

    for (valIndex; valIndex <= max; valIndex++) {
      if ((valIndex - hit - 1) % scale === 0) {
        bucketIndex++;
        this.buckets[bucketIndex] = this.getEmptyBucket(
          valIndex === lastBucketLeftBorder
            ? `> ${lastBucketLeftBorder - 1}`
            : `${valIndex} - ${valIndex + scale - 1}`
        );
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
