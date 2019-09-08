import { Channel, connect, Connection } from 'amqplib';
import { settings } from '../statistics';

class AMQPConnector {
  private static _instance: AMQPConnector;

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
    });
  }
}

export default AMQPConnector.getInstance();
