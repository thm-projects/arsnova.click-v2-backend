import * as bodyParser from 'body-parser';
import * as compress from 'compression';
import * as cors from 'cors';
import * as express from 'express';
import { Request, Response, Router } from 'express';
import * as logger from 'morgan';
import * as path from 'path';
import { RoutingControllersOptions, useExpressServer } from 'routing-controllers';
import * as swaggerUi from 'swagger-ui-express';
import options from './lib/cors.config';
import { IGlobal } from './main';
import { roleAuthorizationChecker } from './routers/middleware/roleAuthorizationChecker';

import { dynamicStatistics, staticStatistics } from './statistics';

declare var global: any;

export const routingControllerOptions: RoutingControllersOptions = {
  defaults: {
    nullResultCode: 405,
    undefinedResultCode: 204,
    paramOptions: {
      required: true,
    },
  },
  authorizationChecker: roleAuthorizationChecker,
  defaultErrorHandler: true,
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
    this._express = express();

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

    this._express.use((err, req, res, next) => {
      if (process.env.NODE_ENV === 'production') {
        (<IGlobal>global).createDump(err);
      }
      next();
    });
  }
}

export default new App().express;
