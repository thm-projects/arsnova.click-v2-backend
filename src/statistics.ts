import { hostname } from 'os';
import * as path from 'path';
import * as process from 'process';
import { LeaderboardConfiguration } from './enums/LeaderboardConfiguration';

const config = require(path.join(__dirname, 'config.json'));

const basePath = process.env.ARSNOVA_CLICK_BACKEND_BASE_PATH || config.basePath || '';
const portInternal = +process.env.ARSNOVA_CLICK_BACKEND_PORT_INTERNAL || config.portInternal || 3010;
const scuttlebuttPort = +process.env.ARSNOVA_CLICK_BACKEND_PORT_SCUTTLEBUTT || config.portScuttlebutt || parseInt(portInternal + 10, 10) || 3020;
const prometheusPort = +process.env.ARSNOVA_CLICK_BACKEND_PORT_PROMETHEUS || config.portPrometheus || parseInt(scuttlebuttPort + 10, 10) || 3030;
const portExternal = +process.env.ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL || config.portExternal || portInternal;
const routePrefix = process.env.ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX || config.routePrefix || '';
const rewriteAssetCacheUrl = process.env.ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL || config.rewriteAssetCacheUrl
                             || `http://${hostname()}:${portExternal}${routePrefix}`;
const leaderboardAlgorithm = process.env.LEADERBOARD_ALGORITHM || config.leaderboardAlgorithm || LeaderboardConfiguration.PointBased;

const amqpProtocol = process.env.AMQP_PROTOCOL || 'amqp';
const amqpHostname = process.env.AMQP_HOSTNAME || 'localhost';
const amqpVhost = process.env.AMQP_VHOST || '/';
const amqpUser = process.env.AMQP_USER || 'guest';
const amqpPassword = process.env.AMQP_PASSWORD || 'guest';
const amqpManagementApiProtocol = process.env.AMQP_MANAGEMENT_API_PROTOCOL || 'http:';
const amqpManagementApiHost = process.env.AMQP_MANAGEMENT_API_HOST || amqpHostname;
const amqpManagementApiPort = process.env.AMQP_MANAGEMENT_API_PORT || '15672';
const amqpManagementUser = process.env.AMQP_MANAGEMENT_USER || amqpUser;
const amqpManagementPassword = process.env.AMQP_MANAGEMENT_PASSWORD || amqpPassword;

const frontendGitlabId = parseInt(process.env.GITLAB_FRONTEND_PROJECT_ID, 10);
const backendGitlabId = parseInt(process.env.GITLAB_BACKEND_PROJECT_ID, 10);
const gitlabLoginToken = process.env.GITLAB_TOKEN;
const gitlabHost = process.env.GITLAB_HOST;
const gitlabTargetBranch = process.env.GITLAB_TARGET_BRANCH ?? 'master';

const twitterEnabled = process.env.TWITTER_ENABLED ?? false;
const twitterConsumerKey = process.env.TWITTER_CONSUMER_KEY;
const twitterConsumerSecret = process.env.TWITTER_CONSUMER_SECRET;
const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;
const twitterAccessTokenKey = process.env.TWITTER_ACCESS_TOKEN_KEY;
const twitterAccessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
const twitterSearchKey = process.env.TWITTER_SEARCH_KEY;

const chromiumPath = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium-browser';

const projectEmail = process.env.PROJECT_MAIL_ADDRESS;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

const logoFilename = process.env.LOGO_FILE_NAME ?? 'logo_transparent.png';

const version = config.version ?? '__VERSION__';

export const publicSettings = {
  leaderboardAlgorithm,
  cacheQuizAssets: true,
  createQuizPasswordRequired: false,
  limitActiveQuizzes: Infinity,
};

export const settings = {
  appName: 'arsnova-click-v2-backend',
  appVersion: version,
  port: {
    app: portInternal,
    scuttlebutt: scuttlebuttPort,
    prometheus: prometheusPort,
  },
  routePrefix: routePrefix,
  rewriteAssetCacheUrl: rewriteAssetCacheUrl,
  pathToAssets: path.join(__dirname, basePath, process.env.NODE_ENV === 'production' ? '' : '..', 'assets'),
  pathToMigrations: path.join(__dirname, basePath, process.env.NODE_ENV === 'production' ? '' : '..', 'db-migration'),
  jwtSecret: 'arsnova.click-v2',
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
  gitlab: {
    frontend: frontendGitlabId,
    backend: backendGitlabId,
    loginToken: gitlabLoginToken,
    host: gitlabHost,
    targetBranch: gitlabTargetBranch,
  },
  twitter: {
    twitterAccessTokenKey,
    twitterAccessTokenSecret,
    twitterConsumerKey,
    twitterConsumerSecret,
    twitterBearerToken,
    enabled: twitterEnabled && twitterAccessTokenKey && twitterAccessTokenSecret && twitterConsumerKey && twitterConsumerSecret,
    searchKey: twitterSearchKey ?? 'arsnova.click OR arsnovaclick OR arsnova-click OR @arsnovaclick OR #arsnovaclick OR #arsnova-click',
  },
  chromiumPath,
  projectEMail: projectEmail,
  vapidKeys: {
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
  },
  logoFilename: logoFilename,
};

