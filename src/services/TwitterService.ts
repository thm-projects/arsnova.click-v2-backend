import { EventEmitter } from 'events';
import * as Twitter from 'twitter';
import AMQPConnector from '../db/AMQPConnector';
import MongoDBConnector from '../db/MongoDBConnector';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { ITweet } from '../interfaces/twitter/ITweet';
import { ITwitterApiTweets } from '../interfaces/twitter/ITwitterApi';
import { arraysEqual } from '../lib/array-equal';
import { settings } from '../statistics';
import LoggerService from './LoggerService';

class TwitterService {

  private static INTERVAL = 90000;
  private static _instance: TwitterService;
  public currentTweets: Array<ITweet> = [];
  public readonly currentTweetsChanged = new EventEmitter();
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

  private mapJsonToTweet(json: Array<ITwitterApiTweets>): ITweet[] {
    return json.map(status => {
      return {
        created_at: status.created_at,
        id: status.id,
        text: status.text,
        truncated: status.truncated,
        name: status.user.name,
        lang: status.lang,
        user_url: status.user.url,
        followers_count: status.user.followers_count,
        profile_image_url_https: status.user.profile_image_url_https,
        url: `https://twitter.com/i/web/status/${status.id_str}`,
        screen_name: status.user.screen_name,
        extended_entities: status.extended_entities?.media.filter(media => media.type === 'photo').map(media => (
          {
            media_url_https: media.media_url_https,
          }
        )),
      };
    });
  }

  private async retrieveTweets(): Promise<void> {
    let client: Twitter;
    if (settings.twitter.twitterBearerToken) {
      client = new Twitter({
        consumer_key: settings.twitter.twitterConsumerKey,
        consumer_secret: settings.twitter.twitterConsumerSecret,
        bearer_token: settings.twitter.twitterBearerToken,
      });
    } else {
      client = new Twitter({
        consumer_key: settings.twitter.twitterConsumerKey,
        consumer_secret: settings.twitter.twitterConsumerSecret,
        access_token_key: settings.twitter.twitterAccessTokenKey,
        access_token_secret: settings.twitter.twitterAccessTokenSecret,
      });
    }

    const params: Twitter.RequestParams = { q: settings.twitter.searchKey };
    client.get('statuses/mentions_timeline', params, (error, tweets: Array<ITwitterApiTweets>, response) => {
      if (error) {
        const msg = Array.isArray(error) ? error.map(e => e.message).join(', ') : error.message ?? error;
        LoggerService.error('Requesting recent Tweets with TwitterApi has failed with error: ' + msg);
        return;
      }

      const newTweets = this.mapJsonToTweet(tweets);
      if (arraysEqual(this.currentTweets, newTweets)) {
        LoggerService.debug('No new tweets found');
        return;
      }
      this.currentTweets = newTweets;
      this.publishNewTweets();
    });
  }

  private async publishNewTweets(): Promise<void> {
    this.currentTweetsChanged.emit('update', this.currentTweets);
    try {
      AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
        status: StatusProtocol.Success,
        step: MessageProtocol.RequestTweets,
      })));
    } catch (err) {
      LoggerService.error('Publishing message to global exchange of rabbit mq has failed with error: ' + err);
    }
  }
}

export default TwitterService.getInstance();
