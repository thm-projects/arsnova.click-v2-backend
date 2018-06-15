declare function require(name: string): any;

import * as fs from 'fs';
import * as lowdb from 'lowdb';
import { AdapterSync } from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import * as path from 'path';
import { createHomePath } from '../app_bootstrap';
import { AbstractDAO } from './AbstractDAO';

export enum DatabaseTypes {
  quiz = 'quiz', assets = 'assets'
}

const homedir = require('os').homedir();
const pathToDb = path.join(homedir, '.arsnova-click-v2-backend', 'arsnova-click-v2-db-v1.json');
if (createHomePath) {
  createHomePath();
} else {
  // Reimplement the createHomePath function because it is not defined in mocha
  const pathToOutput = path.join(homedir, '.arsnova-click-v2-backend');
  if (!fs.existsSync(pathToOutput)) {
    fs.mkdirSync(pathToOutput);
  }
}

// DB Lib: https://github.com/typicode/lowdb
const adapter: AdapterSync = new FileSync(pathToDb);
const db = lowdb(adapter);

class DbDAO extends AbstractDAO<typeof db> {

  constructor() {
    super(db);
    const state = this.getState();
    if (!state[DatabaseTypes.quiz]) {
      this.initDb(DatabaseTypes.quiz, []);
    }
    if (!state[DatabaseTypes.assets]) {
      this.initDb(DatabaseTypes.assets, {});
    }
  }

  public static getInstance(): DbDAO {
    if (!this.instance) {
      this.instance = new DbDAO();
    }
    return this.instance;
  }

  public create(database: DatabaseTypes, data: object, ref?: string): void {
    if (ref) {
      this.storage.set(`${database}.${ref}`, data).write();
    } else {
      this.storage.get(database).push(data).write();
    }
  }

  public read(database: DatabaseTypes, query?: object): object {
    if (query) {
      return this.storage.get(database).find(query).value();
    }
    return this.storage.get(database).value();
  }

  public update(database: DatabaseTypes, query: object, update: object): void {
    this.storage.get(database).find(query).assign(update).write();
  }

  public delete(database: DatabaseTypes, query: { quizName: string, privateKey: string }): boolean {
    const dbContent: any = this.read(database, query);
    if (!dbContent || dbContent.privateKey !== query.privateKey) {
      return false;
    }
    this.storage.get(database).remove(query).write();
    return true;
  }

  public closeConnections(): void {
    Object.keys(DatabaseTypes).forEach((type) => this.closeConnection(DatabaseTypes[type]));
  }

  public getState(): typeof lowdb {
    return this.storage.getState();
  }

  private closeConnection(database: DatabaseTypes): void {
    this.storage.get(database);
  }

  private initDb(type: DatabaseTypes, initialValue: any): void {
    this.storage.set(type, initialValue).write();
  }
}

export default DbDAO.getInstance();
