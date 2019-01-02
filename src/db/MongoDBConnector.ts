import * as mongoose from 'mongoose';
import { Connection } from 'mongoose';
import { Database } from '../enums/DbOperation';
import LoggerService from '../services/LoggerService';

class MongoDbConnector {
  get dbName(): string {
    return this._dbName;
  }

  private readonly _dbName: string;
  private _mongoURL = process.env.MONGODB_CONN_URL;

  constructor() {
    this._dbName = MongoDbConnector.buildDbName();
    this.buildUrl(this._dbName);
    LoggerService.info(`Db connectionString: ${this._mongoURL}`);
  }

  public connect(mongoDatabase: string): Promise<Connection> {

    return new Promise(async (resolve, reject) => {

      const db = mongoose.connection;
      db.once('error', (error) => {
        db.close();
        reject(error);
      });
      db.once('open', () => {
        LoggerService.info('Successfully connected to the db');
        resolve(db);
      });

      await mongoose.connect(this._mongoURL, {
        useCreateIndex: true,
        autoIndex: true,
        useNewUrlParser: true,
      } as any);
    });
  }

  private static buildDbName(): string {
    return `${Database.Default}`;
  }

  private buildUrl(mongoDatabase: string): void {
    if (this._mongoURL != null) {
      return;
    }

    const mongoHost = process.env.MONGODB_SERVICE_NAME || 'localhost';
    const mongoPort = process.env.MONGODB_SERVICE_PORT || '27017';
    const mongoReplSet = process.env.MONGODB_REPLICA_NAME || 'rs0';
    const mongoPassword = process.env.MONGODB_PASSWORD;
    const mongoUser = process.env.MONGODB_USER;

    if (mongoHost && mongoPort && mongoDatabase) {
      this._mongoURL = 'mongodb://';

      if (mongoUser && mongoPassword) {
        this._mongoURL += `${mongoUser}:${mongoPassword}@`;
      }
      this._mongoURL += `${mongoHost}:${mongoPort}/${mongoDatabase}`;

      const mongoURLOptions = [`authSource=admin`];
      if (process.env.MONGODB_REPLICA_NAME) {
        mongoURLOptions.push(`replicaSet=${mongoReplSet}`);
      }
      this._mongoURL += `?${mongoURLOptions.join('&')}`;
    }
  }
}

export default new MongoDbConnector();
