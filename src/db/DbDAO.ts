import { EventEmitter } from 'events';
import { Cursor, DeleteWriteOpResultObject, FilterQuery, FindOneOptions, InsertOneWriteOpResult, UpdateWriteOpResult } from 'mongodb';
import { Connection } from 'mongoose';
import { DbCollection, DbEvent } from '../enums/DbOperation';
import { IDbObject } from '../interfaces/database/IDbObject';
import LoggerService from '../services/LoggerService';
import { AbstractDAO } from './AbstractDAO';
import MongoDBConnector from './MongoDBConnector';

class DbDAO extends AbstractDAO<object> {
  private static DB_RECONNECT_INTERVAL = 1000 * 60 * 5; // 5 Minutes
  public readonly DB = MongoDBConnector.dbName;

  private _dbCon: Connection = null;

  get dbCon(): Connection {
    return this._dbCon;
  }

  private _isDbAvailable = new EventEmitter();

  get isDbAvailable(): EventEmitter {
    return this._isDbAvailable;
  }

  private _isConnected = false;

  constructor(_storage: object) {
    super(_storage);

    this.connectToDb();
  }

  public static getInstance(): DbDAO {
    if (!this.instance) {
      this.instance = new DbDAO({});
    }
    return this.instance;
  }

  public create(collection: string, elem: IDbObject | object): Promise<InsertOneWriteOpResult<any>> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).insertOne(elem);
  }

  public readOne(collection: string, query: FilterQuery<any>, options?: FindOneOptions): Promise<any> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).findOne(query, options);
  }

  public readMany(collection: string, query: FilterQuery<any>): Cursor<any> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).find(query);
  }

  public updateOne(collection: string, query: FilterQuery<any>, update: object): Promise<UpdateWriteOpResult> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).updateOne(query, { $set: update });
  }

  public updateMany(collection: string, query: FilterQuery<any>, update: object): Promise<UpdateWriteOpResult> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).updateMany(query, { $set: update });
  }

  public deleteOne(collection: string, query: FilterQuery<any>): Promise<DeleteWriteOpResultObject> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).deleteOne(query);
  }

  public deleteMany(collection: string, query: FilterQuery<any>): Promise<DeleteWriteOpResultObject> {
    if (!this._isConnected || !this._dbCon) {
      return;
    }

    return this._dbCon.collection(collection).deleteMany(query);
  }

  public clearStorage(): void {
  }

  private connectToDb(): Promise<void> {
    return MongoDBConnector.connect(this.DB).then((db: Connection) => {
      this._dbCon = db;
      this._dbCon.useDb(this.DB);

      Object.keys(DbCollection).forEach(collection => {
        collection = collection.toLowerCase();

        if (!this._dbCon.collection(collection)) {
          LoggerService.info('Creating not existing collection', collection);
          this._dbCon.createCollection(collection, {
            validationLevel: 'strict',
            validationAction: 'error',
          });
        }
      });

      LoggerService.info(`Db connected`);

      this._isConnected = true;
      this._isDbAvailable.emit(DbEvent.Connected, true);

      db.on('error', () => {
        this._isDbAvailable.emit(DbEvent.Connected, false);
      });

    }).catch((error) => {
      LoggerService.error(`Db connection failed with error ${error}, will retry in ${DbDAO.DB_RECONNECT_INTERVAL / 1000} seconds`);

      this._isConnected = false;
      this._isDbAvailable.emit(DbEvent.Connected, false);

      setTimeout(this.connectToDb.bind(this), DbDAO.DB_RECONNECT_INTERVAL);
    });
  }
}

export default DbDAO.getInstance();
