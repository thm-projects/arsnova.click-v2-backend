declare function require(name: string): any;

import { setGlobalOptions } from '@typegoose/typegoose';
import * as cluster from 'cluster';
import * as http from 'http';
import { Server } from 'http';
import * as Minimist from 'minimist';
import * as net from 'net';
import * as process from 'process';
import 'reflect-metadata';
import * as Model from 'scuttlebutt/model';
import { setVapidDetails } from 'web-push';
import App from './App';
import AssetDAO from './db/AssetDAO';
import CasDAO from './db/CasDAO';
import DbDAO from './db/DbDAO';
import I18nDAO from './db/I18nDAO';
import MathjaxDAO from './db/MathjaxDAO';
import MemberDAO from './db/MemberDAO';
import QuizDAO from './db/QuizDAO';
import UserDAO from './db/UserDAO';
import { IPCExchange } from './enums/IPCExchange';
import LoggerService from './services/LoggerService';
import TwitterService from './services/TwitterService';
import { settings, staticStatistics } from './statistics';
import { LoadTester } from './tests/LoadTester';

setGlobalOptions({
  globalOptions: {
    useNewEnum: true,
  },
});

require('source-map-support').install();

Error.stackTraceLimit = Infinity;

declare var global: any;

export interface IGlobal extends NodeJS.Global {
  DAO: {
    AssetDAO: {}, CasDAO: {}, I18nDAO: {}, MathjaxDAO: {}, QuizDAO: {}, DbDAO: {}, UserDAO: {}, MemberDAO: {},
  };
  Services: {
    TwitterService: {}
  };
}

interface IInetAddress {
  port: number;
  family: string;
  address: string;
}

(
  <IGlobal>global
).Services = {
  TwitterService,
};

(
  <IGlobal>global
).DAO = {
  AssetDAO,
  CasDAO,
  I18nDAO,
  MathjaxDAO,
  QuizDAO,
  DbDAO,
  UserDAO,
  MemberDAO,
};

const port: string | number | boolean = normalizePort(staticStatistics.port);
App.set('port', port);

const numWorkers = process.env.NODE_ENV !== 'test' ? require('os').cpus().length - 1 : 2;
let server: Server;

if (cluster.isMaster) {
  LoggerService.info(`Booting NodeJS ${process.version} on ${process.arch} architecture`);
  LoggerService.info(`[Master ${process.pid}] is running`);
  const workers = [];

  const masterModel = new Model();
  net.createServer((stream) => {
    stream.pipe(masterModel.createStream()).pipe(stream);
  }).listen(8000, () => {
    for (let i = 0; i < numWorkers; i++) {
      workers[i] = cluster.fork();

      workers[i].on('message', ({ message, data }) => {
        switch (message) {
          case IPCExchange.QuizStart:
            LoggerService.info('[Master] QuizStart from worker received');
            QuizDAO.startNextQuestion(data);
            break;
          case IPCExchange.QuizStop:
            LoggerService.info('[Master] QuizStop from worker received');
            QuizDAO.stopQuizTimer(data);
            break;
        }
      });
    }
  });

  cluster.on('exit', (worker) => {
    LoggerService.error(`[Worker ${worker.process.pid}] died`);
  });

  TwitterService.run();

  I18nDAO.reloadCache().then(() => {
    masterModel.set(IPCExchange.I18nCache, I18nDAO.storage);
    LoggerService.info(`[Master] updated i18n-cache`);
  }).catch(reason => {
    LoggerService.error('Could not reload i18n dao cache. Reason:', reason);
  });

  DbDAO.connectToDb();

} else {

  const workerModel = new Model();
  const stream = net.connect(8000);
  stream.pipe(workerModel.createStream()).pipe(stream);
  workerModel.on('update', data => {
    switch (data[0]) {
      case IPCExchange.I18nCache:
        I18nDAO.setStorageData(workerModel.get(data[0]));
        LoggerService.info(`[Worker] received i18n-cache update`);
    }
  });

  server = http.createServer(App);
  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);
  server.on('close', onClose);

  DbDAO.connectToDb();

  const argv = Minimist(process.argv.slice(2));
  if (argv['load-test']) {
    runTest();
  }

  setVapidDetails(
    `mailto:${settings.projectEMail}`,
    settings.vapidKeys.publicKey,
    settings.vapidKeys.privateKey,
  );

  LoggerService.info(`[Worker ${process.pid}] started`);
}

function normalizePort(val: number | string): number | string | boolean {
  const portCheck: number = (
                              typeof val === 'string'
                            ) ? parseInt(val, 10) : val;
  if (isNaN(portCheck)) {
    return val;
  } else if (portCheck >= 0) {
    return portCheck;
  } else {
    return false;
  }
}

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }
  const bind: string = (
                         typeof port === 'string'
                       ) ? 'Pipe ' + port : 'Port ' + port;
  switch (error.code) {
    case 'EACCESS':
      LoggerService.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      LoggerService.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  const addr: IInetAddress | string = server.address();
  const bind: string = (
                         typeof addr === 'string'
                       ) ? `pipe ${addr}` : `port ${addr.port}`;
  LoggerService.info(`Listening on ${bind}`);
}

function runTest(): void {
  console.log('----- Running Load Test -----');
  console.log(`CPU Time Spent Begin: ${process.cpuUsage().user / 1000000}`);
  const startTime = new Date().getTime();
  const loadTest = new LoadTester();
  loadTest.done.on('done', () => {
    console.log(`CPU Time Spent End: ${process.cpuUsage().user / 1000000}`);
    console.log(`Load Test took ${(
                                    new Date().getTime() - startTime
                                  ) / 1000}`);
    console.log('----- Load Test Finished -----');
  });
}

function onClose(): void {}

