declare function require(name: string): any;

import * as child_process from 'child_process';
import * as http from 'http';
import { Server } from 'http';
import * as path from 'path';
import * as process from 'process';
import * as WebSocket from 'ws';
import App from './App';
import { createDefaultPaths } from './app_bootstrap';
import CasDAO from './db/CasDAO';
import DbDAO from './db/DbDAO';
import I18nDAO from './db/I18nDAO';
import LoginDAO from './db/LoginDAO';
import MathjaxDAO from './db/MathjaxDAO';
import QuizManagerDAO from './db/QuizManagerDAO';
import { WebSocketRouter } from './routes/websocket';
import { staticStatistics } from './statistics';

require('source-map-support').install();

declare var global: any;
declare var module: any;

interface IHotModule extends NodeModule {
  hot: {
    accept: Function
  };
}

export declare interface IGlobal extends NodeJS.Global {
  DAO: {
    CasDAO: {}, I18nDAO: {}, MathjaxDAO: {}, QuizManagerDAO: {}, DbDAO: {}, LoginDAO: {}
  };
  createDump: Function;
}

declare interface IInetAddress {
  port: number;
  family: string;
  address: string;
}

function censor(data: any): any {
  let i = 0;

  return (key, value) => {
    if (i !== 0 && typeof(
      data
    ) === 'object' && typeof(
      value
    ) === 'object' && data === value) {
      return '[Circular]';
    }

    if (i >= 29) {// seems to be a harded maximum of 30 serialized objects?
      return '[Unknown]';
    }

    ++i; // so we know we aren't using the original object anymore

    return value;
  };
}

function rejectionToCreateDump(reason): void {
  (
    <IGlobal>global
  ).createDump(reason);
}

process.on('unhandledRejection', rejectionToCreateDump);
process.on('uncaughtException', rejectionToCreateDump);

(
  <IGlobal>global
).DAO = {
  CasDAO,
  I18nDAO,
  MathjaxDAO,
  QuizManagerDAO,
  DbDAO,
  LoginDAO,
};
(
  <IGlobal>global
).createDump = (plainError) => {
  const error = {
    type: '',
    code: '',
    message: '',
    stack: '',
  };

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

  Object.keys((
    <IGlobal>global
  ).DAO).forEach((dao) => {
    daoDump[dao] = (
      <IGlobal>global
    ).DAO[dao].createDump();
  });

  const insecureDumpAsJson = JSON.stringify(daoDump, censor(daoDump));

  const dumpCryptorParams: ReadonlyArray<string> = [
    path.join(staticStatistics.pathToJobs, 'DumpCryptor.js'), `--base-path=${__dirname}`, '--command=encrypt', `--data=${insecureDumpAsJson}`,
  ];
  const dumpCryptorInstance = child_process.spawn(`node`, dumpCryptorParams);
  dumpCryptorInstance.stderr.on('data', (data) => {
    console.log(`DumpCryptor (stderr): ${data.toString().replace('\n', '')}`);
  });
  dumpCryptorInstance.on('exit', () => {
    console.log(`DumpCryptor (exit): Dump generated`);
  });

  const mailParams: ReadonlyArray<string> = [
    path.join(staticStatistics.pathToJobs, 'SendMail.js'),
    '--command=buildServerInfoMail',
    `--attachment=${insecureDumpAsJson}`,
    `--header=Arsnova.click Server Error Report (${error.type}: ${error.message})`,
    `--text=${error.stack || JSON.stringify('<unknown> - no stack provided')}`,
  ];
  const mailInstance = child_process.spawn(`node`, mailParams);
  mailInstance.stderr.on('data', (data) => {
    console.log(`SendMail (stderr): ${data.toString().replace('\n', '')}`);
  });
  mailInstance.stdout.on('data', (data) => {
    console.log(`SendMail (stdout): ${data.toString().replace('\n', '')}`);
  });
  mailInstance.on('exit', () => {
    console.log(`SendMail (exit): Done`);
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

if ((
  <IHotModule>module
).hot) {
  (
    <IHotModule>module
  ).hot.accept('./main', () => {
    server.removeListener('request', currentApp);
    currentApp = require('./main');
    server.on('request', currentApp);
  });
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
  const bind: string = (
                         typeof addr === 'string'
                       ) ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`Listening on ${bind}`);

  WebSocketRouter.wss = new WebSocket.Server({ server });

  I18nDAO.reloadCache();
}

function onClose(): void {
  WebSocketRouter.wss.close();
}
