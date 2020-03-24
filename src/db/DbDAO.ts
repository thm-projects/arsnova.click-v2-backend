import * as childProcess from 'child_process';
import { Connection } from 'mongoose';
import { DbCollection } from '../enums/DbOperation';
import LoggerService from '../services/LoggerService';
import { staticStatistics } from '../statistics';
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
  }

  public static getInstance(): DbDAO {
    if (!this.instance) {
      this.instance = new DbDAO();
    }
    return this.instance;
  }

  public connectToDb(): Promise<void> {
    return MongoDBConnector.connect(this.DB).then((db: Connection) => {
      this._dbCon = db;
      this._dbCon.useDb(this.DB);

      db.on('error', () => {});

      return Promise.all(Object.keys(DbCollection).map(collection => {
        collection = collection.toLowerCase();

        if (!this._dbCon.collection(collection)) {
          LoggerService.info('Creating not existing collection', collection);
          return this._dbCon.createCollection(collection, {
            validationLevel: 'strict',
            validationAction: 'error',
          });
        }
      })).then(() => this.runMigrations());

    }).catch((error) => {
      LoggerService.error(`Db connection failed with error ${error}, will retry in ${DbDAO.DB_RECONNECT_INTERVAL / 1000} seconds`);

      setTimeout(this.connectToDb.bind(this), DbDAO.DB_RECONNECT_INTERVAL);
    });
  }

  private async runMigrations(): Promise<void> {
    LoggerService.info(`[DB-Migration] start`);

    const migrationProcess = childProcess.execSync('node db-migration-bootstrap',
      { cwd: staticStatistics.pathToMigrations, env: process.env, stdio: 'pipe', encoding: 'utf-8' });
    const results = migrationProcess.split('\n');
    results.pop();
    results.forEach(result => LoggerService.info(result));

    LoggerService.info(`[DB-Migration] finished`);
  }
}

export default DbDAO.getInstance();
