import App from './App';

import * as debug from 'debug';
import * as WebSocket from 'ws';
import * as http from 'http';
import {WebSocketRouter} from './routes/websocket';
import {Server} from 'http';
import * as process from 'process';
import {DbDao} from './db/DbDAO';
import {staticStatistics} from './statistics';
import {createDefaultPaths} from './app_bootstrap';

debug('arsnova.click: ts-express:server');

declare global {
  interface NodeModule {
    hot: {
      accept: Function
    };
  }
}

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
  module.hot.accept('./index', () => {
    server.removeListener('request', currentApp);
    server.on('request', App);
    currentApp = App;
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
  const addr: { port: number; family: string; address: string; } = server.address();
  const bind: string = (typeof addr === 'string') ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`Listening on ${bind}`);

  WebSocketRouter.wss = new WebSocket.Server({server});
}

function onClose(): void {
  DbDao.closeConnections();

  WebSocketRouter.wss.close();
}
