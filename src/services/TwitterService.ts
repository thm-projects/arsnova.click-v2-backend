import * as Twitter from 'twitter';
import AMQPConnector from '../db/AMQPConnector';
import MongoDBConnector from '../db/MongoDBConnector';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { ITweet } from '../interfaces/twitter/ITweet';
import { ITwitterApi } from '../interfaces/twitter/ITwitterApi';
import { arraysEqual } from '../lib/array-equal';
import { settings, staticStatistics } from '../statistics';
import LoggerService from './LoggerService';

class TwitterService {

  private static INTERVAL = 90000;
  private static _instance: TwitterService;
  public currentTweets: Array<ITweet> = [];
  private intervalInstance;

  public static getInstance(): TwitterService {
    if (!this._instance) {
      this._instance = new TwitterService();
    }
    return this._instance;
  }

  public run(): void {
    if (!settings.twitter.enabled) {
      return;
    }

    MongoDBConnector.rabbitEventEmitter.on('connected', () => {
      this.retrieveTweets();
    });

    this.intervalInstance = setInterval(() => {
      this.retrieveTweets();
    }, TwitterService.INTERVAL);
  }

  private stop(): void {
    clearInterval(this.intervalInstance);
    this.intervalInstance = null;
  }

  private mapJsonToTweet(json: ITwitterApi): ITweet[] {
    return json.statuses.map(status => {
      return {
        created_at: status.created_at,
        id: status.id,
        text: status.text,
        truncated: status.truncated,
        name: status.user.name,
        user_url: status.user.url,
        followers_count: status.user.followers_count,
        profile_image_url_https: status.user.profile_image_url_https,
        url: `https://twitter.com/i/web/status/${status.id_str}`,
        screen_name: status.user.screen_name,
      };
    });
  }

  private async retrieveTweets(): Promise<void> {
    const client = new Twitter({
      consumer_key: settings.twitter.twitterConsumerKey,
      consumer_secret: settings.twitter.twitterConsumerSecret,
      access_token_key: settings.twitter.twitterAccessTokenKey,
      access_token_secret: settings.twitter.twitterAccessTokenSecret,
    });

    // const params = { q: 'arsnova.click' };
    const params = { q: staticStatistics.twitter.searchKey };
    client.get('search/tweets', params, (error, tweets: ITwitterApi, response) => {
      if (error) {
        LoggerService.error('Requesting recent Tweets with TwitterApi has failed with error:' + error.join(','));
        return;
      }

      const newTweets = this.mapJsonToTweet(tweets);
      if (arraysEqual(this.currentTweets, newTweets)) {
        LoggerService.info('No new tweets found');
        return;
      }
      this.currentTweets = newTweets;
      this.publishNewTweets();
    });
  }

  private async publishNewTweets(): Promise<void> {
    try {
      AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
        status: StatusProtocol.Success,
        step: MessageProtocol.RequestTweets,
      })));
    } catch (err) {
      LoggerService.error('Publishing message to global exchange of rabbit mq has failed with error:' + err);
    }
  }
}

export default TwitterService.getInstance();
