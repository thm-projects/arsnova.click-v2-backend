import { NextFunction, Request, Response, Router } from 'express';
import availableNicks from '../nicknames/availableNicks';
import illegalNicks from '../nicknames/illegalNicks';

export class NicksRouter {
  private _router: Router;

  get router(): Router {
    return this._router;
  }

  /**
   * Initialize the NicksRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public getAllAvailableNicks(req: Request, res: Response): void {
    res.send(availableNicks);
  }

  public getAllBlockedNicks(req: Request, res: Response): void {
    res.send(illegalNicks);
  }

  public init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/predefined', this.getAllAvailableNicks);
    this._router.get('/blocked', this.getAllBlockedNicks);
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }
}

// Create the ApiRouter, and export its configured Express.Router
const nicksRoutes = new NicksRouter();
const nicksRouter = nicksRoutes.router;
export { nicksRouter };
