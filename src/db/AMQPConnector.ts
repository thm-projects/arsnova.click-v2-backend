import { Channel, connect, Connection } from 'amqplib';
import { settings } from '../statistics';

class AMQPConnector {
  private static _instance: AMQPConnector;
  public readonly globalExchange: string = 'global';

  private _channel: Channel;

  get channel(): Channel {
    return this._channel;
  }

  private _connection: Connection;

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

  public buildQuizExchange(quizname: string): string {
    if (!quizname) {
      throw new Error(`Could not build exchange name. Quizname '${quizname}' is not supported.`);
    }
    return encodeURI(`quiz_${quizname.trim()}`);
  }
}

export default AMQPConnector.getInstance();
