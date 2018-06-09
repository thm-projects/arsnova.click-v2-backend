declare function require(name: string);

import * as child_process from 'child_process';
import * as http from 'http';
import { Server } from 'http';
import * as path from 'path';
import * as process from 'process';
import * as WebSocket from 'ws';
import App from './App';
import { createDefaultPaths } from './app_bootstrap';
import { CasDAO } from './db/CasDAO';
import { DbDAO } from './db/DbDAO';
import { I18nDAO } from './db/I18nDAO';
import { MathjaxDAO } from './db/MathjaxDAO';
import { QuizManagerDAO } from './db/QuizManagerDAO';
import { WebSocketRouter } from './routes/websocket';
import { staticStatistics } from './statistics';

require('source-map-support').install();

declare global {
  interface NodeModule {
    hot: {
      accept: Function
    };
  }

  namespace NodeJS {
    interface Global {
      DAO: {
        CasDAO: {},
        I18nDAO: {},
        MathjaxDAO: {},
        QuizManagerDAO: {},
        DbDAO: {},
      };
      createDump: Function;
    }
  }
}

declare interface IInetAddress {
  port: number;
  family: string;
  address: string;
}

function censor(data) {
  let i = 0;

  return function (key, value) {
    if (i !== 0 && typeof(data) === 'object' && typeof(value) === 'object' && data === value) {
      return '[Circular]';
    }

    ++i; // so we know we aren't using the original object anymore

    return value;
  };
}

function rejectionToCreateDump(reason) {
  global.createDump(reason);
}

function isObject(obj) {
  return obj === Object(obj);
}

process.on('unhandledRejection', rejectionToCreateDump);

global.DAO = { CasDAO, I18nDAO, MathjaxDAO, QuizManagerDAO, DbDAO };
global.createDump = (plainError) => {
  const error = { type: '', code: '', message: '', stack: '' };

  if (plainError) {
    if (typeof plainError === 'string') {
      try {
        throw new Error(plainError);
      } catch (e) {
        plainError = e;
      }
    }
    error.type = plainError.constructor.name;
    error.code = plainError.code;
    error.message = plainError.message;
    error.stack = plainError.stack;
  }

  const daoDump = { error };

  Object.keys(global.DAO).forEach((dao, index) => {
    daoDump[dao] = global.DAO[dao].createDump();
  });

  const params = [
    path.join(staticStatistics.pathToJobs, 'DumpCryptor.js'),
    `--base-path=${__dirname}`,
    '--command=encrypt',
    `--data=${JSON.stringify(daoDump, censor(daoDump))}`,
  ];
  const instance = child_process.spawn(`node`, params);
  instance.stderr.on('data', (data) => {
    console.log(`DumpCryptor (stderr): ${data.toString().replace('\n', '')}`);
  });
  instance.on('exit', () => {
    console.log(`DumpCryptor (exit): Dump generated`);
  });
};

createDefaultPaths();

const port: string | number | boolean = normalizePort(staticStatistics.port);
App.set('port', port);

const server: Server = http.createServer(App);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
server.on('close', onClose);

let currentApp = App;

if (module.hot) {
  module.hot.accept('./main', () => {
    server.removeListener('request', currentApp);
    currentApp = require('./main');
    server.on('request', currentApp);
  });
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
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  const addr: IInetAddress | string = server.address();
  const bind: string = (typeof addr === 'string') ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`Listening on ${bind}`);

  WebSocketRouter.wss = new WebSocket.Server({ server });

  I18nDAO.reloadCache();
}

function onClose(): void {
  DbDAO.closeConnections();

  WebSocketRouter.wss.close();
}
