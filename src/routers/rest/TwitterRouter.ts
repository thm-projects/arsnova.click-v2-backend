import { Get, JsonController } from 'routing-controllers';
import { ITweet } from '../../interfaces/twitter/ITweet';
import TwitterService from '../../services/TwitterService';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/twitter')
export class TwitterRouter extends AbstractRouter {

  @Get('/recentTweets')
  private getAllTweets(): ITweet[] {
    return TwitterService.currentTweets;
  }
}


