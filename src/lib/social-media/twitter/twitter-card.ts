import { SocialMediaCardType } from '../../../enums/SocialMediaCardType';
import { SocialMediaCard } from '../social-media-card';

export class TwitterCard extends SocialMediaCard {

  public cardType = SocialMediaCardType.Twitter;

  constructor(mf: any) {
    super(mf);
  }

  public buildCard(imageUrl: string, quizname: string): string {
    const description = `${this._mf('social-media.card.description')}`;

    return `<meta http-equiv="refresh" content="0; URL=/">` + //
           `<meta name="twitter:card" content="summary">` + //
           `<meta name="twitter:site" content="@arsnovaclick">` + //
           `<meta name="twitter:title" content="${quizname}">` + //
           `<meta name="twitter:description" content="${description}">` + //
           `<meta name="twitter:image" content="${imageUrl}">`;
  }
}
