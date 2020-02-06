import { Connection } from 'mongoose';
import { DbCollection } from '../enums/DbOperation';
import LoggerService from '../services/LoggerService';
import { AbstractDAO } from './AbstractDAO';
import MongoDBConnector from './MongoDBConnector';

class DbDAO extends AbstractDAO {
  private static DB_RECONNECT_INTERVAL = 1000 * 60; // 1 Minute
  public readonly DB = MongoDBConnector.dbName;

  private _dbCon: Connection = null;

  get dbCon(): Connection {
    return this._dbCon;
  }

  constructor() {
    super();

    this.connectToDb();
  }

  public static getInstance(): DbDAO {
    if (!this.instance) {
      this.instance = new DbDAO();
    }
    return this.instance;
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
      db.on('error', () => {});

    }).catch((error) => {
      LoggerService.error(`Db connection failed with error ${error}, will retry in ${DbDAO.DB_RECONNECT_INTERVAL / 1000} seconds`);

      setTimeout(this.connectToDb.bind(this), DbDAO.DB_RECONNECT_INTERVAL);
    });
  }
}

export default DbDAO.getInstance();
