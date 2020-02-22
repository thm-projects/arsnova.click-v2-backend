import { SocialMediaCardType } from '../../enums/SocialMediaCardType';

export abstract class SocialMediaCard {
  protected readonly cardType: SocialMediaCardType;
  protected readonly _mf: any;

  protected constructor(mf: any) {
    this._mf = mf;
  }

  public abstract buildCard(imageUrl: string, quizname: string, mf: any): string;
}
