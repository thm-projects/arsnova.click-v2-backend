import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import { Request, Response, Router } from 'express';
import ExpiryQuizDAO from '../db/ExpiryQuizDAO';

export class ExpiryQuizRouter {
  get router(): Router {
    return this._router;
  }

  private readonly _router: Router;

  /**
   * Initialize the ExpiryQuizRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  private init(): void {
    this._router.get('/', this.getAll);

    this._router.post('/quiz', this.postQuiz);
  }

  private getAll(req: Request, res: Response): void {
    const quiz: IQuestionGroup = ExpiryQuizDAO.getCurrentQuestionGroup();
    const expiry: Date = ExpiryQuizDAO.expiry;

    res.json({
      quiz,
      expiry,
    });
  }

  private postQuiz(req: Request, res: Response): void {
    if (!req.body.quiz || !req.body.expiry) {

      res.sendStatus(500);
      res.write(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'POST_QUIZ',
      }));

      return;
    }

    ExpiryQuizDAO.setQuestionGroup(req.body.quiz, new Date(req.body.expiry));

    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'POST_QUIZ',
    });
  }

}

// Create the ApiRouter, and export its configured Express.Router
const routes = new ExpiryQuizRouter();
const router = routes.router;
export { router };
