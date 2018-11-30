import * as bodyParser from 'body-parser';
import * as compress from 'compression';
import * as busboy from 'connect-busboy';
import * as express from 'express';
import { Request, Response, Router } from 'express';
import * as i18n from 'i18n';
import * as logger from 'morgan';
import * as path from 'path';
import { createExpressServer, RoutingControllersOptions } from 'routing-controllers';
import * as swaggerUi from 'swagger-ui-express';
import options from './cors.config';
import { IGlobal } from './main';

import { dynamicStatistics, staticStatistics } from './statistics';

declare var require: any;
declare var global: any;

i18n.configure({
  // setup some locales - other locales default to en silently
  locales: ['en', 'de', 'it', 'es', 'fr'],

  // fall back from Dutch to German
  fallbacks: { 'nl': 'de' },

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
  logWarnFn: msg => {
    console.log('warn', msg);
  },

  // setting of log level ERROR - default to require('debug')('i18n:error')
  logErrorFn: msg => {
    console.log('error', msg);
  },

  // object or [obj1, obj2] to bind the i18n api and current locale to - defaults to null
  register: global,

  // hash to specify different aliases for i18n's internal methods to apply on the request/response objects (method -> alias).
  // note that this will *not* overwrite existing properties with the same name
  api: {
    '__': 't',  // now req.__ becomes req.t
    '__n': 'tn', // and req.__n can be called as req.tn
  },
});

export const routingControllerOptions: RoutingControllersOptions = {
  defaults: {
    nullResultCode: 404,
    undefinedResultCode: 204,
    paramOptions: {
      required: true,
    },
  },
  defaultErrorHandler: false,
  cors: options,
  controllers: [path.join(__dirname, 'routers', '/rest/*.js')],
  middlewares: [path.join(__dirname, 'routers', '/middleware/*.js')],
};

// Creates and configures an ExpressJS web server.
class App {

  get express(): express.Application {
    return this._express;
  }

  // ref to Express instance
  private readonly _express: express.Application;

  // Run configuration methods on the Express instance.
  constructor() {
    this._express = createExpressServer(routingControllerOptions);
    this.middleware();
    this.routes();
  }

  // Configure Express middleware.
  private middleware(): void {
    this._express.use(logger('dev'));
    this._express.use(busboy());
    this._express.use(bodyParser.json({ limit: '50mb' }));
    this._express.use(bodyParser.urlencoded({
      limit: '50mb',
      extended: true,
    }));
    this._express.use(i18n.init);
    this._express.use(compress());
  }

  // Configure API endpoints.
  private routes(): void {
    this._express.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
      swaggerUrl: '/api/v1/api-docs.json',
    }));

    const router: Router = express.Router();
    router.get(`/`, (req: Request, res: Response) => {
      res.send(Object.assign({}, staticStatistics, dynamicStatistics()));
    });
    router.get(`/err`, () => {
      throw new Error('testerror');
    });

    this._express.use(`${staticStatistics.routePrefix}/`, router);

    this._express.use((err, req, res, next) => {
      (<IGlobal>global).createDump(err);
      next();
    });
  }
}

export default new App().express;
