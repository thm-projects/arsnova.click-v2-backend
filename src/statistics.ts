import { cpus, freemem, hostname, loadavg, networkInterfaces, totalmem } from 'os';
import * as path from 'path';
import * as process from 'process';
import QuizManagerDAO from './db/QuizManagerDAO';

declare function require(name: string): any;

export const homedir = require('os').homedir();
const interfaces = networkInterfaces();
const localAddress = interfaces[Object.keys(interfaces).filter(netIface => {
  const singleInterface = interfaces[netIface][0];
  return singleInterface.family === 'IPv4' && singleInterface.internal === false;
})[0]];
const localIpv4Address = localAddress ? localAddress[0].address : '127.0.0.1';
const basePath = process.env.ARSNOVA_CLICK_BACKEND_BASE_PATH || '';
const portInternal = +process.env.ARSNOVA_CLICK_BACKEND_PORT_INTERNAL || 3000;
const portExternal = +process.env.ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL || portInternal;
const routePrefix = process.env.ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX || '';
const rewriteAssetCacheUrl = process.env.ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL || `http://${hostname()}:${portExternal}${routePrefix}`;

export const staticStatistics = {
  appName: 'arsnova-click-v2-backend',
  appVersion: '2.0.0',
  hostname: hostname(),
  port: portInternal,
  routePrefix: `${routePrefix}`,
  localIpv4Address: localIpv4Address,
  rewriteAssetCacheUrl: rewriteAssetCacheUrl,
  pathToAssets: path.join(__dirname, basePath, process.env.NODE_ENV === 'production' ? '' : '..', 'assets'),
  pathToCache: path.join(homedir, '.arsnova-click-v2-backend', 'asset_cache'),
  pathToJobs: path.join(__dirname, basePath, process.env.NODE_ENV === 'production' ? '' : '..', 'jobs'),
  cpuCores: cpus().length,
  jwtSecret: 'arsnova.click-v2'
};

export const dynamicStatistics = () => {
  return {
    uptime: process.uptime(),
    loadavg: loadavg(),
    freemem: freemem(),
    totalmem: totalmem(),
    connectedUsers: QuizManagerDAO.getAllActiveMembers(),
    activeQuizzes: QuizManagerDAO.getAllActiveQuizNames(),
    persistedQuizzes: Object.keys(QuizManagerDAO.getAllPersistedQuizzes()).length,
  };
};

export const settings = {
  public: {
    cacheQuizAssets: true,
    createQuizPasswordRequired: false,
    limitActiveQuizzes: Infinity,
  },
  limitQuizCreationToCasAccounts: [],
  createQuizPassword: 'abc',
};

export const cache = { 'arsnova-click-v2-backend': {} };
export const availableLangs = ['EN', 'DE', 'FR', 'ES', 'IT'];
export const projectGitLocation = {
  'arsnova-click-v2-backend': path.join(__dirname),
};
export const projectBaseLocation = {
  'arsnova-click-v2-backend': path.join(projectGitLocation['arsnova-click-v2-backend']),
};
export const projectAppLocation = {
  'arsnova-click-v2-backend': path.join(projectBaseLocation['arsnova-click-v2-backend']),
};
export const i18nFileBaseLocation = {
  'arsnova-click-v2-backend': path.join(staticStatistics.pathToAssets, 'i18n'),
};
