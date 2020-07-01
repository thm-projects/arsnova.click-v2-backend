import { Channel, connect, Connection } from 'amqplib';
import * as routeCache from 'route-cache';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { RoutingCache } from '../enums/RoutingCache';
import { settings } from '../statistics';

class AMQPConnector {
  private static _instance: AMQPConnector;
  public readonly RECONNECT_INTERVAL = 1000 * 60; // 1 Minute
  public readonly globalExchange: string = 'global';
  public readonly quizExchange: string = 'quiz';

  private _channel: Channel;
  private _sendStatisticsTimeout: any;

  get channel(): Channel {
    return this._channel;
  }

  private _connection: Connection;
  private _lastStatisticRequestSent: number;

  constructor() {
  }

  public static getInstance(): AMQPConnector {
    if (!this._instance) {
      this._instance = new AMQPConnector();
    }

    return this._instance;
  }

  public async initConnection(): Promise<void> {
    this._connection = await connect({
      protocol: settings.amqp.protocol,
      hostname: settings.amqp.hostname,
      username: settings.amqp.user,
      password: settings.amqp.password,
      vhost: settings.amqp.vhost,
    });
    this._channel = await this._connection.createChannel();
    this._channel.on('error', error => {
      console.error('Exception in amqp channel occured', error);
      this.initConnection();
    });
  }

  public prepareQuiznameForQuery(quizName: string): string {
    return quizName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

  public buildQuizExchange(quizname: string): string {
    if (!quizname) {
      throw new Error(`Could not build exchange name. Quizname '${quizname}' is not supported.`);
    }
    return `${this.prepareQuiznameForQuery(encodeURIComponent(quizname))}`;
  }

  public sendRequestStatistics(): boolean {
    const diff = new Date().getTime() - this._lastStatisticRequestSent;
    clearTimeout(this._sendStatisticsTimeout);
    if (diff < 500) {
      this._sendStatisticsTimeout = setTimeout(() => this.sendRequestStatistics(), diff);
      return;
    }

    this._lastStatisticRequestSent = new Date().getTime();

    routeCache.removeCache(RoutingCache.Statistics);

    return this.channel?.publish(this.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.RequestStatistics,
    })));
  }
}

export default AMQPConnector.getInstance();
