import { captureException } from '@sentry/node';
import * as express from 'express';
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from 'routing-controllers';

@Middleware({ type: 'after' })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {

  constructor() { }

  public error(error: HttpError, req: express.Request, res: express.Response, next: express.NextFunction): void {
    // It seems like some decorators handle setting the response (i.e. class-validators)
    if (!res.headersSent) {
      res.status(error.httpCode || 500);

      res.json({
        name: error.name,
        message: error.message,
        errors: error['errors'] || [],
      });
    }

    if (!error.httpCode || error.httpCode >= 500) {
      captureException(error);
    }
    console.error(error.stack);
  }
}
