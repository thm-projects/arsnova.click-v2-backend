import {Router, Request, Response} from 'express';
import {QuizManagerDAO} from '../db/QuizManagerDAO';
import {CasDAO} from '../db/CasDAO';
import {DbDAO} from '../db/DbDAO';
import {MathjaxDAO} from '../db/MathjaxDAO';

export class DebugRouter {
  get router(): Router {
    return this._router;
  }

  private readonly _router: Router;

  /**
   * Initialize the DebugRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public getAll(req, res) {
    res.send(`Debug router`);
  }

  public getDAOs(req: Request, res: Response): void {
    /* This will output an empty object to the client. NodeJS debug inspection is required to inspect the variables! */
    res.send({
      DbDAO,
      QuizManagerDAO,
      CasDAO,
      MathjaxDAO
    });
  }

  public init(): void {
    this._router.get('/', this.getAll);
    this._router.get('/daos', this.getDAOs);
  }
}

// Create the ApiRouter, and export its configured Express.Router
const debugRoutes = new DebugRouter();
const debugRouter = debugRoutes.router;
export { debugRouter };
