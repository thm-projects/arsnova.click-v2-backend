import { cpus, freemem, hostname, loadavg, networkInterfaces, totalmem } from 'os';
import * as path from 'path';
import * as process from 'process';
import { Language } from './enums/Enums';
import { LeaderboardConfiguration } from './enums/LeaderboardConfiguration';

const config = require(path.join(__dirname, 'config.json'));

const interfaces = networkInterfaces();
const localAddress = interfaces[Object.keys(interfaces).filter(netIface => {
  const singleInterface = interfaces[netIface][0];
  return singleInterface.family === 'IPv4' && singleInterface.internal === false;
})[0]];
const localIpv4Address = localAddress ? localAddress[0].address : '127.0.0.1';

const basePath = process.env.ARSNOVA_CLICK_BACKEND_BASE_PATH || config.basePath || '';
const portInternal = +process.env.ARSNOVA_CLICK_BACKEND_PORT_INTERNAL || config.portInternal || 3010;
const portExternal = +process.env.ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL || config.portExternal || portInternal;
const routePrefix = process.env.ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX || config.routePrefix || '';
const rewriteAssetCacheUrl = process.env.ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL || config.rewriteAssetCacheUrl
                             || `http://${hostname()}:${portExternal}${routePrefix}`;
const leaderboardAlgorithm = process.env.LEADERBOARD_ALGORITHM || config.leaderboardAlgorithm || LeaderboardConfiguration.TimeBased;

const amqpProtocol = process.env.AMQP_PROTOCOL || 'amqp';
const amqpHostname = process.env.AMQP_HOSTNAME || 'localhost';
const amqpVhost = process.env.AMQP_VHOST || '/';
const amqpUser = process.env.AMQP_USER || 'guest';
const amqpPassword = process.env.AMQP_PASSWORD || 'guest';
const amqpManagementApiProtocol = process.env.AMQP_MANAGEMENT_API_PROTOCOL || 'http:';
const amqpManagementApiHost = process.env.AMQP_MANAGEMENT_API_HOST || 'localhost';
const amqpManagementApiPort = process.env.AMQP_MANAGEMENT_API_PORT || '15672';
const amqpManagementUser = process.env.AMQP_MANAGEMENT_USER || amqpUser;
const amqpManagementPassword = process.env.AMQP_MANAGEMENT_PASSWORD || amqpPassword;

export const staticStatistics = {
  appName: 'arsnova-click-v2-backend',
  appVersion: '2.0.0',
  hostname: hostname(),
  port: portInternal,
  routePrefix: `${routePrefix}`,
  localIpv4Address: localIpv4Address,
  rewriteAssetCacheUrl: rewriteAssetCacheUrl,
  pathToAssets: path.join(__dirname, basePath, process.env.NODE_ENV === 'production' ? '' : '..', 'assets'),
  pathToJobs: path.join(__dirname, basePath, process.env.NODE_ENV === 'production' ? '' : '..', 'jobs'),
  cpuCores: cpus().length,
  jwtSecret: 'arsnova.click-v2',
  leaderboardAlgorithm,
};

export const dynamicStatistics = () => {
  return {
    uptime: process.uptime(),
    loadavg: loadavg(),
    freemem: freemem(),
    totalmem: totalmem(),
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
  amqp: {
    protocol: amqpProtocol,
    hostname: amqpHostname,
    vhost: amqpVhost,
    user: amqpUser,
    password: amqpPassword,
    managementApi: {
      host: amqpManagementApiHost,
      protocol: amqpManagementApiProtocol,
      port: amqpManagementApiPort,
      user: amqpManagementUser,
      password: amqpManagementPassword,
    },
  },
};

export const availableLangs = Object.values(Language);
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
