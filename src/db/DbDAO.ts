declare function require(name: string): any;

import * as fs from 'fs';
import * as lowdb from 'lowdb';
import { AdapterSync } from 'lowdb';
import * as FileSync from 'lowdb/adapters/FileSync';
import * as MemoryDb from 'lowdb/adapters/Memory';
import * as Minimist from 'minimist';
import * as path from 'path';
import * as process from 'process';
import { createHomePath } from '../app_bootstrap';
import { DATABASE_TYPE } from '../Enums';
import { AbstractDAO } from './AbstractDAO';

const argv = Minimist(process.argv.slice(2));
const homedir = require('os').homedir();
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
let adapter: AdapterSync;
if (typeof argv.db !== 'undefined' && !argv.db) {
  adapter = new MemoryDb('');
} else {
  let pathToDb: string;
  if (typeof argv.db === 'string') {
    pathToDb = path.join(homedir, '.arsnova-click-v2-backend', argv.db);
  } else {
    pathToDb = path.join(homedir, '.arsnova-click-v2-backend', 'arsnova-click-v2-db-v1.json');
  }
  adapter = new FileSync(pathToDb);
}
const db = lowdb(adapter);

class DbDAO extends AbstractDAO<typeof db> {

  constructor() {
    super(db);
    const state = this.getState();
    if (!state[DATABASE_TYPE.QUIZ]) {
      this.initDb(DATABASE_TYPE.QUIZ, []);
    }
    if (!state[DATABASE_TYPE.ASSETS]) {
      this.initDb(DATABASE_TYPE.ASSETS, {});
    }
    if (!state[DATABASE_TYPE.USERS]) {
      this.initDb(DATABASE_TYPE.USERS, {});
    }
  }

  public static getInstance(): DbDAO {
    if (!this.instance) {
      this.instance = new DbDAO();
    }
    return this.instance;
  }

  public create(database: DATABASE_TYPE, data: object, ref?: string): void {
    if (ref) {
      this.storage.set(`${database}.${ref}`, data).write();
    } else {
      this.storage.get(database).push(data).write();
    }
  }

  public read(database: DATABASE_TYPE, query?: object): object {
    if (query) {
      return this.storage.get(database).find(query).value();
    }
    return this.storage.get(database).value();
  }

  public update(database: DATABASE_TYPE, query: object, update: object): void {
    this.storage.get(database).find(query).assign(update).write();
  }

  public delete(database: DATABASE_TYPE, query: { quizName: string, privateKey: string }): boolean {
    const dbContent: any = this.read(database, query);
    if (!dbContent || dbContent.privateKey !== query.privateKey) {
      return false;
    }
    this.storage.get(database).remove(query).write();
    return true;
  }

  public closeConnections(): void {
    Object.keys(DATABASE_TYPE).forEach((type) => this.closeConnection(DATABASE_TYPE[type]));
  }

  public getState(): typeof lowdb {
    return (
      <lowdb.LowdbBase<any>>this.storage
    ).getState();
  }

  private closeConnection(database: DATABASE_TYPE): void {
    this.storage.get(database);
  }

  private initDb(type: DATABASE_TYPE, initialValue: any): void {
    this.storage.set(type, initialValue).write();
  }
}

export default DbDAO.getInstance();
