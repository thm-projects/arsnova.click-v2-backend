import * as express from 'express';
import * as logger from 'morgan';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as busboy from 'connect-busboy';
import * as i18n from 'i18n';
import * as path from 'path';

import {NextFunction, Router, Response, Request} from 'express';
import options from './cors.config';
import {dynamicStatistics, staticStatistics} from './statistics';

import {apiRouter} from './routes/api';
import {libRouter} from './routes/lib';
import {legacyApiRouter} from './routes/legacy-api';
import {quizRouter} from './routes/quiz';
import {lobbyRouter} from './routes/lobby';
import {nicksRouter} from './routes/nicks';
import {themesRouter} from './routes/themes';
import {memberRouter} from './routes/member';

i18n.configure({
  // setup some locales - other locales default to en silently
  locales: ['en', 'de', 'it', 'es', 'fr'],

  // fall back from Dutch to German
  fallbacks: {'nl': 'de'},

  // where to store json files - defaults to './locales' relative to modules directory
  directory: path.join(staticStatistics.pathToAssets, 'i18n'),

  // watch for changes in json files to reload locale on updates - defaults to false
  autoReload: true,

  // whether to write new locale information to disk - defaults to true
  updateFiles: false,

  // sync locale information across all files - defaults to false
  syncFiles: false,

  // what to use as the indentation unit - defaults to "\t"
  indent: '\t',

  // setting extension of json files - defaults to '.json' (you might want to set this to '.js' according to webtranslateit)
  extension: '.json',

  // setting prefix of json files name - default to none ''
  // (in case you use different locale files naming scheme (webapp-en.json), rather then just en.json)
  prefix: '',

  // enable object notation
  objectNotation: true,

  // setting of log level DEBUG - default to require('debug')('i18n:debug')
  logDebugFn: require('debug')('i18n:debug'),

  // setting of log level WARN - default to require('debug')('i18n:warn')
  logWarnFn: function (msg) {
    console.log('warn', msg);
  },

  // setting of log level ERROR - default to require('debug')('i18n:error')
  logErrorFn: function (msg) {
    console.log('error', msg);
  },

  // object or [obj1, obj2] to bind the i18n api and current locale to - defaults to null
  register: global,

  // hash to specify different aliases for i18n's internal methods to apply on the request/response objects (method -> alias).
  // note that this will *not* overwrite existing properties with the same name
  api: {
    '__': 't',  // now req.__ becomes req.t
    '__n': 'tn' // and req.__n can be called as req.tn
  }
});

// Creates and configures an ExpressJS web server.
class App {

  get express(): express.Application {
    return this._express;
  }

  // ref to Express instance
  private readonly _express: express.Application;

  // Run configuration methods on the Express instance.
  constructor() {
    this._express = express();
    this.middleware();
    this.routes();
  }

  // Configure Express middleware.
  private middleware(): void {
    this._express.use(logger('dev'));
    this._express.use(busboy());
    this._express.use(bodyParser.json());
    this._express.use(i18n.init);
    this._express.use(bodyParser.urlencoded({extended: false}));
    this._express.use(cors(options));
    this._express.options('*', cors(options));
  }

  // Configure API endpoints.
  private routes(): void {
    const router: Router = express.Router();
    router.get(`/`, (req: Request, res: Response, next: NextFunction) => {
      res.send(Object.assign({}, staticStatistics, dynamicStatistics()));
    });
    this._express.use(`${staticStatistics.routePrefix}/`, router);
    this._express.use(`${staticStatistics.routePrefix}/lib`, libRouter);
    this._express.use(`${staticStatistics.routePrefix}/api`, legacyApiRouter);
    this._express.use(`${staticStatistics.routePrefix}/api/v1`, apiRouter);
    this._express.use(`${staticStatistics.routePrefix}/api/v1/quiz`, quizRouter);
    this._express.use(`${staticStatistics.routePrefix}/api/v1/member`, memberRouter);
    this._express.use(`${staticStatistics.routePrefix}/api/v1/lobby`, lobbyRouter);
    this._express.use(`${staticStatistics.routePrefix}/api/v1/nicks`, nicksRouter);
    this._express.use(`${staticStatistics.routePrefix}/api/v1/themes`, themesRouter);
  }

}

export default new App().express;
