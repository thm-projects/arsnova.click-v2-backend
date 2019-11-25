declare function require(name: string): any;

import * as http from 'http';
import { Server } from 'http';
import * as Minimist from 'minimist';
import * as process from 'process';
import 'reflect-metadata';
import App from './App';
import AssetDAO from './db/AssetDAO';
import CasDAO from './db/CasDAO';
import DbDAO from './db/DbDAO';
import I18nDAO from './db/I18nDAO';
import MathjaxDAO from './db/MathjaxDAO';
import MemberDAO from './db/MemberDAO';
import QuizDAO from './db/quiz/QuizDAO';
import UserDAO from './db/UserDAO';
import LoggerService from './services/LoggerService';
import { staticStatistics } from './statistics';
import { LoadTester } from './tests/LoadTester';

require('source-map-support').install();
require('./lib/regExpEscape'); // Installing polyfill for RegExp.escape

Error.stackTraceLimit = Infinity;

declare var global: any;
declare var module: any;

interface IHotModule extends NodeModule {
  hot: {
    accept: Function
  };
}

export interface IGlobal extends NodeJS.Global {
  DAO: {
    AssetDAO: {}, CasDAO: {}, I18nDAO: {}, MathjaxDAO: {}, QuizDAO: {}, DbDAO: {}, UserDAO: {}, MemberDAO: {},
  };
}

interface IInetAddress {
  port: number;
  family: string;
  address: string;
}

if (process.env.NODE_ENV === 'production') {
  const Sentry = require('@sentry/node');
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

(<IGlobal>global).DAO = {
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

LoggerService.info(`Booting NodeJS ${process.version} on ${process.arch} architecture`);

const server: Server = http.createServer(App);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
server.on('close', onClose);

const argv = Minimist(process.argv.slice(2));
if (argv['load-test']) {
  runTest();
}

function normalizePort(val: number | string): number | string | boolean {
  const portCheck: number = (typeof val === 'string') ? parseInt(val, 10) : val;
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
  const bind: string = (typeof port === 'string') ? 'Pipe ' + port : 'Port ' + port;
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
  const bind: string = (typeof addr === 'string') ? `pipe ${addr}` : `port ${addr.port}`;
  LoggerService.info(`Listening on ${bind}`);

  I18nDAO.reloadCache().catch(reason => {
    console.error('Could not reload i18n dao cache', reason);
  });
}

function runTest(): void {
  console.log('----- Running Load Test -----');
  console.log(`CPU Time Spent Begin: ${process.cpuUsage().user / 1000000}`);
  const startTime = new Date().getTime();
  const loadTest = new LoadTester();
  loadTest.done.on('done', () => {
    console.log(`CPU Time Spent End: ${process.cpuUsage().user / 1000000}`);
    console.log(`Load Test took ${(new Date().getTime() - startTime) / 1000}`);
    console.log('----- Load Test Finished -----');
  });
}

function onClose(): void {}
