// DB Lib: https://github.com/typicode/lowdb

import * as lowdb from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';

export enum DatabaseTypes {
  quiz = 'quiz',
  assets = 'assets'
}

const adapter: FileSync = new FileSync('arsnova-click-v2-db-v1.json');

export class DbDAO {

  private static db: lowdb;
  private static instance: DbDAO;

  public static create(database: DatabaseTypes, data: Object, ref?: string): void {
    if (ref) {
      DbDAO.db.set(`${database}.${ref}`, data).write();
    } else {
      DbDAO.db.get(database).push(data).write();
    }
  }

  public static read(database: DatabaseTypes, query?: Object): Object {
    if (query) {
      return DbDAO.db.get(database)
                  .find(query)
                  .value();
    }
    return DbDAO.db.get(database)
                .value();
  }

  public static update(database: DatabaseTypes, query: Object, update: Object): void {
    DbDAO.db.get(database)
         .find(query)
         .assign(update)
         .write();
  }

  public static delete(database: DatabaseTypes, query: {quizName: string, privateKey: string}): boolean {
    const dbContent: any = DbDAO.read(database, query);
    if (!dbContent || dbContent.privateKey !== query.privateKey) {
      return false;
    }
    DbDAO.db.get(database)
         .remove(query)
         .write();
    return true;
  }

  public static closeConnection(database: DatabaseTypes): void {
    DbDAO.db.get(database).close();
  }

  public static closeConnections(): void {
    Object.keys(DatabaseTypes).forEach((type) => DbDAO.closeConnection(DatabaseTypes[type]));
  }

  public static getState(): lowdb {
    return DbDAO.db.getState();
  }

  public static getInstance(): DbDAO {
    if (!DbDAO.instance) {
      DbDAO.instance = new DbDAO();
      DbDAO.db = lowdb(adapter);
      const state = DbDAO.getState();
      if (!state[DatabaseTypes.quiz]) {
        DbDAO.initDb(DatabaseTypes.quiz, []);
      }
      if (!state[DatabaseTypes.assets]) {
        DbDAO.initDb(DatabaseTypes.assets, {});
      }
    }
    return DbDAO.instance;
  }

  private static initDb(type: DatabaseTypes, initialValue: any) {
    DbDAO.db.set(type, initialValue).write();
  }
}

export default DbDAO.getInstance();
