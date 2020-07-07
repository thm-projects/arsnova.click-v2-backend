declare function require(name: string): any;

import { setGlobalOptions } from '@typegoose/typegoose';
import * as cluster from 'cluster';
import * as express from 'express';
import * as promBundle from 'express-prom-bundle';
import * as http from 'http';
import { Server } from 'http';
import * as Minimist from 'minimist';
import * as net from 'net';
import * as process from 'process';
import 'reflect-metadata';
import * as routeCache from 'route-cache';
import * as Model from 'scuttlebutt/model';
import { setVapidDetails } from 'web-push';
import App from './App';
import AssetDAO from './db/AssetDAO';
import DbDAO from './db/DbDAO';
import I18nDAO from './db/I18nDAO';
import MathjaxDAO from './db/MathjaxDAO';
import MemberDAO from './db/MemberDAO';
import QuizDAO from './db/QuizDAO';
import UserDAO from './db/UserDAO';
import { IPCExchange } from './enums/IPCExchange';
import { RoutingCache } from './enums/RoutingCache';
import { MemberModel } from './models/member/MemberModel';
import { QuizModel } from './models/quiz/QuizModelItem';
import LoggerService from './services/LoggerService';
import TwitterService from './services/TwitterService';
import { settings } from './statistics';
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
    AssetDAO: {}, I18nDAO: {}, MathjaxDAO: {}, QuizDAO: {}, DbDAO: {}, UserDAO: {}, MemberDAO: {},
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
  I18nDAO,
  MathjaxDAO,
  QuizDAO,
  DbDAO,
  UserDAO,
  MemberDAO,
};

const port = normalizePort(settings.port.app);
const scuttlebuttPort = normalizePort(settings.port.scuttlebutt);
const prometheusPort = normalizePort(settings.port.prometheus);
App.set('port', port);

const numWorkers = process.env.NODE_ENV !== 'test' ? require('os').cpus().length - 1 : 2;
let server: Server;

if (cluster.isMaster) {
  LoggerService.info(`Booting NodeJS ${process.version} on ${process.arch} architecture`);
  LoggerService.info(`[Master ${process.pid}] is running`);
  const workers: Array<cluster.Worker> = [];

  const masterModel = new Model();
  net.createServer((stream) => {
    stream.pipe(masterModel.createStream()).pipe(stream);
  }).listen(scuttlebuttPort, () => {
    for (let i = 0; i < numWorkers; i++) {
      workers[i] = cluster.fork();

      workers[i].on('message', ({ message, data }) => {
        switch (message) {
          case IPCExchange.QuizStart:
            LoggerService.info(`[Master] QuizStart for quiz (${data}) from worker received`);
            DbDAO.caches.emit('purge', [
              `${RoutingCache.QuizStatus}_${data}`,
              `${RoutingCache.QuizFullStatus}_${data}`,
              `${RoutingCache.CurrentQuizState}_${data}`,
              `${RoutingCache.QuizStartTime}_${data}`,
              `${RoutingCache.QuizSettings}_${data}`,
              `${RoutingCache.QuizData}_${data}`
            ]);
            QuizDAO.startNextQuestion(data);
            break;
          case IPCExchange.QuizStop:
            LoggerService.info(`[Master] QuizStop for quiz (${data}) from worker received`);
            DbDAO.caches.emit('purge', [
              `${RoutingCache.QuizStatus}_${data}`,
              `${RoutingCache.QuizFullStatus}_${data}`,
              `${RoutingCache.CurrentQuizState}_${data}`,
              `${RoutingCache.QuizStartTime}_${data}`,
              `${RoutingCache.QuizSettings}_${data}`,
              `${RoutingCache.QuizData}_${data}`
            ]);
            QuizDAO.stopQuizTimer(data);
            break;
        }
      });
    }
  });

  cluster.on('exit', (worker) => {
    LoggerService.error(`[Worker ${worker.process.pid}] died`);
  });

  I18nDAO.reloadCache().then(() => {
    masterModel.set(IPCExchange.I18nCache, I18nDAO.storage);
    LoggerService.info(`[Master] updated i18n-cache`);
  }).catch(reason => {
    LoggerService.error('Could not reload i18n dao cache. Reason:', reason);
  });

  TwitterService.currentTweetsChanged.on('update', currentTweets => masterModel.set(IPCExchange.TwitterCache, currentTweets));
  TwitterService.run();

  MemberDAO.totalUsersChanged.on('update', totalUsers => masterModel.set(IPCExchange.TotalUsers, totalUsers));

  DbDAO.connectToDb().then(async () => {
    const argv = Minimist(process.argv.slice(2));
    if (argv._.includes('load-test')) {
      LoggerService.debug(`[LoadTest Master] Removing existing loadtest quizzes and attendees`);
      await QuizModel.deleteMany({ name: /[loadtest].*/ });
      await MemberModel.deleteMany({ currentQuizName: /[loadtest].*/ });
    }
  });
  DbDAO.caches.on('purge', keys => masterModel.set(IPCExchange.PurgeCache, keys));

  const metricsServer = express();
  metricsServer.use('/metrics', promBundle.clusterMetrics());
  metricsServer.listen(prometheusPort);

} else {

  const workerModel = new Model();
  const stream = net.connect(scuttlebuttPort);
  stream.pipe(workerModel.createStream()).pipe(stream);
  workerModel.on('update', data => {
    switch (data[0]) {
      case IPCExchange.I18nCache:
        I18nDAO.setStorageData(workerModel.get(data[0]));
        LoggerService.info(`[Worker] received i18n-cache update`);
        break;
      case IPCExchange.TwitterCache:
        TwitterService.currentTweets = workerModel.get(data[0]);
        LoggerService.info(`[Worker] received twitter-cache update`);
        break;
      case IPCExchange.TotalUsers:
        MemberDAO.totalUsers = workerModel.get(data[0]);
        LoggerService.info(`[Worker] received total-users update`);
        break;
      case IPCExchange.PurgeCache:
        LoggerService.info(`[Worker] received purge-cache update. Purging http cache`);
        workerModel.get(data[0]).forEach(key => routeCache.removeCache(key));
    }
  });

  server = http.createServer(App);
  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);
  server.on('close', onClose);

  DbDAO.connectToDb().then(() => {
    const argv = Minimist(process.argv.slice(2));
    if (argv._.includes('load-test')) {
      runTest();
    }
  });

  if (settings.projectEMail && settings.vapidKeys.publicKey && settings.vapidKeys.privateKey) {
    setVapidDetails(
      `mailto:${settings.projectEMail}`,
      settings.vapidKeys.publicKey,
      settings.vapidKeys.privateKey,
    );
  }

  LoggerService.info(`[Worker ${process.pid}] started`);
}

function normalizePort(val: string): number {
  return parseInt(val, 10);
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
  LoggerService.debug('----- Running Load Test -----');
  LoggerService.debug(`CPU Time Spent Begin: ${process.cpuUsage().user / 1000000}`);
  const startTime = new Date().getTime();
  const loadTest = new LoadTester();
  loadTest.done.on('done', () => {
    LoggerService.debug(`CPU Time Spent End: ${process.cpuUsage().user / 1000000}`);
    LoggerService.debug(`Load Test took ${(new Date().getTime() - startTime) / 1000} seconds`);
    LoggerService.debug('----- Load Test Finished -----');
  });
}

function onClose(): void {}

