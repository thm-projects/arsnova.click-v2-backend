import { Replies } from 'amqplib';
import { EventEmitter } from 'events';
import * as mongoose from 'mongoose';
import { Connection } from 'mongoose';
import { Database } from '../enums/DbOperation';
import LoggerService from '../services/LoggerService';
import AMQPConnector from './AMQPConnector';

class MongoDbConnector {
  private _externalServicesEmitter: EventEmitter = new EventEmitter();

  get externalServicesEmitter(): EventEmitter {
    return this._externalServicesEmitter;
  }

  private _rabbitEventEmitter: EventEmitter = new EventEmitter();

  get rabbitEventEmitter(): EventEmitter {
    return this._rabbitEventEmitter;
  }

  get dbName(): string {
    return this._dbName;
  }

  private _mongoMigrationsURL: string;
  private readonly _dbName: string;
  private _mongoURL = process.env.MONGODB_CONN_URL;
  private _isConnected = false;

  constructor() {
    this._dbName = MongoDbConnector.buildDbName();
    this.buildUrl(this._dbName);
    LoggerService.info(`Db connectionString: ${this._mongoURL}`);
    this._externalServicesEmitter.once('connected', () => LoggerService.info('External services connected'));
  }

  public connect(mongoDatabase: string): Promise<Connection> {
    return new Promise(async (resolve, reject) => {
      const db = mongoose.connection;
      db.once('error', (error) => {
        db.close();
        reject(error);
      });
      db.once('open', () => {
        resolve(db);
      });

      await Promise.all([
        this.initRabbitMQConnection().then(() => LoggerService.info('RabbitMQ connected')), mongoose.connect(this._mongoURL, {
          useCreateIndex: true,
          autoIndex: true,
          useNewUrlParser: true,
          useFindAndModify: false,
          useUnifiedTopology: true,
        } as any).then(() => LoggerService.info('MongoDB connected')),
      ]).then(() => this._externalServicesEmitter.emit('connected'));
    });
  }

  private async initRabbitMQConnection(): Promise<Array<Replies.AssertExchange>> {
    try {
      return AMQPConnector.initConnection().then(() => {
        return Promise.all([
          AMQPConnector.channel.assertExchange(AMQPConnector.quizExchange, 'topic'),
          AMQPConnector.channel.assertExchange(AMQPConnector.globalExchange, 'fanout')
        ]).then(result => {
          LoggerService.info('AMQP Exchanges initialized');
          this.rabbitEventEmitter.emit('connected');
          return result;
        });
      });
    } catch (ex) {
      LoggerService.error(`RabbitMQ connection failed with error ${ex}, will retry in ${AMQPConnector.RECONNECT_INTERVAL / 1000} seconds`);

      setTimeout(this.initRabbitMQConnection.bind(this), AMQPConnector.RECONNECT_INTERVAL);
    }
  }

  private static buildDbName(): string {
    process.env.MONGODB_DB_NAME = Database.Default as unknown as string;
    return `${Database.Default}`;
  }

  private buildUrl(mongoDatabase: string): void {
    if (this._mongoURL != null) {
      return;
    }

    const mongoHost = process.env.MONGODB_SERVICE_NAME || 'localhost';
    const mongoPort = process.env.MONGODB_SERVICE_PORT || '27017';
    const mongoPassword = process.env.MONGODB_PASSWORD;
    const mongoUser = process.env.MONGODB_USER;

    if (mongoHost && mongoPort && mongoDatabase) {
      this._mongoURL = 'mongodb://';

      if (mongoUser && mongoPassword) {
        this._mongoURL += `${mongoUser}:${mongoPassword}@`;
      }
      this._mongoMigrationsURL = this._mongoURL + `${mongoHost}:${mongoPort}`;
      this._mongoURL += `${mongoHost}:${mongoPort}/${mongoDatabase}`;

      const mongoURLOptions = [];
      if (process.env.MONGODB_AUTH_SOURCE) {
        if (process.env.MONGODB_AUTH_SOURCE !== 'false') {
          mongoURLOptions.push(`authSource=${process.env.MONGODB_AUTH_SOURCE}`);
        }
      } else {
        mongoURLOptions.push(`authSource=admin`);
      }
      if (mongoURLOptions.length) {
        this._mongoURL += `?${mongoURLOptions.join('&')}`;
        this._mongoMigrationsURL += `?${mongoURLOptions.join('&')}`;
      }
      process.env.MONGODB_DB_MIGRATION_CONN_URL = this._mongoMigrationsURL;
    }
  }
}

export default new MongoDbConnector();
