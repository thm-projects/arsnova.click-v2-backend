import {cpus, freemem, loadavg, totalmem, hostname, networkInterfaces} from 'os';
import * as path from 'path';
import {QuizManagerDAO} from './db/QuizManagerDAO';

const interfaces = networkInterfaces();
const localAddress = interfaces[Object.keys(interfaces).filter(netIface => {
  const singleInterface = interfaces[netIface][0];
  return singleInterface.family === 'IPv4' &&
         singleInterface.internal === false;
})[0]];
const localIpv4Address = localAddress ? localAddress[0].address : '127.0.0.1';
const portInternal = +process.env.BACKEND_PORT_INTERNAL || 3000;
const portExternal = +process.env.BACKEND_PORT_EXTERNAL || portInternal;
const routePrefix = process.env.BACKEND_ROUTE_PREFIX || '';
const rewriteAssetCacheUrl = process.env.BACKEND_REWRITE_ASSET_CACHE_URL || `http://${hostname()}:${portExternal}${routePrefix}`;

export const staticStatistics = {
  hostname: hostname(),
  port: portInternal,
  routePrefix: `${routePrefix}`,
  localIpv4Address: localIpv4Address,
  rewriteAssetCacheUrl: rewriteAssetCacheUrl,
  pathToAssets: path.join(__dirname, process.env.NODE_ENV === 'production' ? '' : '..', 'assets'),
  pathToCache: path.join(__dirname, process.env.NODE_ENV === 'production' ? '' : '..', 'cache'),
  cpuCores: cpus().length,
};

export const dynamicStatistics = () => {
  return {
    uptime: process.uptime(),
    loadavg: loadavg(),
    freemem: freemem(),
    totalmem: totalmem(),
    connectedUsers: QuizManagerDAO.getAllActiveMembers(),
    activeQuizzes: QuizManagerDAO.getAllActiveQuizNames(),
    persistedQuizzes: Object.keys(QuizManagerDAO.getAllPersistedQuizzes()).length
  };
};

export const settings = {
  public: {
    cacheQuizAssets: true,
    createQuizPasswordRequired: true,
    limitActiveQuizzes: Infinity
  },
  limitQuizCreationToCasAccounts: [],
  createQuizPassword: 'abc'
};
