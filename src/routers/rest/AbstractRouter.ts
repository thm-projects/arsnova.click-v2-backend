import * as express from 'express';
import { Router } from 'express';

export abstract class AbstractRouter {
  get router(): express.Router {
    return this._router;
  }

  protected readonly _router: express.Router;

  protected constructor() {
    this._router = Router();
  }
}
