import { Handlers, init as sentryInit, Integrations } from '@sentry/node';
import * as bodyParser from 'body-parser';
import * as compress from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import { Request, Response, Router } from 'express';
import * as logger from 'morgan';
import * as process from 'process';
import { RoutingControllersOptions, useExpressServer } from 'routing-controllers';
import * as swaggerUi from 'swagger-ui-express';
import options from './lib/cors.config';
import { ErrorHandlerMiddleware } from './routers/middleware/customErrorHandler';
import { I18nMiddleware } from './routers/middleware/i18n';
import { roleAuthorizationChecker } from './routers/middleware/roleAuthorizationChecker';
import { AdminRouter } from './routers/rest/AdminRouter';
import { ApiRouter } from './routers/rest/ApiRouter';
import { ExpiryQuizRouter } from './routers/rest/ExpiryQuizRouter';
import { I18nApiRouter } from './routers/rest/I18nApiRouter';
import { LibRouter } from './routers/rest/LibRouter';
import { MemberRouter } from './routers/rest/MemberRouter';
import { NicksRouter } from './routers/rest/NicksRouter';
import { QuizPoolRouter } from './routers/rest/QuizPoolRouter';
import { QuizRouter } from './routers/rest/QuizRouter';
import { TwitterRouter } from './routers/rest/TwitterRouter';
import { dynamicStatistics, staticStatistics } from './statistics';

export const routingControllerOptions: RoutingControllersOptions = {
  defaults: {
    nullResultCode: 405,
    undefinedResultCode: 204,
    paramOptions: {
      required: true,
    },
  },
  authorizationChecker: roleAuthorizationChecker,
  defaultErrorHandler: false,
  cors: options,
  controllers: [
    AdminRouter, ApiRouter, ExpiryQuizRouter, I18nApiRouter, LibRouter, MemberRouter, NicksRouter, QuizRouter, QuizPoolRouter, TwitterRouter,
  ],
  middlewares: [I18nMiddleware, ErrorHandlerMiddleware],
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
    App.initializeSentry();

    this._express = express();
    this._express.use(Handlers.requestHandler());

    this.middleware();
    this.routes();

    useExpressServer(this._express, routingControllerOptions);
  }

  // Configure Express middleware.
  private middleware(): void {
    this._express.use(logger('dev'));
    this._express.use(bodyParser.json({ limit: '50mb' }));
    this._express.use(bodyParser.urlencoded({
      limit: '50mb',
      extended: true,
    }));
    this._express.options('*', cors(options));
    this._express.use(compress());
  }

  // Configure API endpoints.
  private routes(): void {
    this._express.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(null, {
      swaggerUrl: `${staticStatistics.rewriteAssetCacheUrl}/api/v1/api-docs.json`,
    }));

    const router: Router = express.Router();
    router.get(`/`, (req: Request, res: Response) => {
      res.send(Object.assign({}, staticStatistics, dynamicStatistics()));
    });
    router.get(`/err`, () => {
      throw new Error('testerror');
    });

    this._express.use(`${staticStatistics.routePrefix}/`, router);
  }

  private static initializeSentry(): void {
    sentryInit({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        new Integrations.OnUncaughtException(), new Integrations.OnUnhandledRejection(),
      ],
      enabled: Boolean(process.env.SENTRY_DSN),
    });
  }
}

export default new App().express;
