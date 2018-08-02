import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/src/communication_protocol';
import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import { Request, Response, Router } from 'express';
import { default as DbDAO } from '../db/DbDAO';
import ExpiryQuizDAO from '../db/ExpiryQuizDAO';
import LoginDAO from '../db/LoginDAO';
import QuizManagerDAO from '../db/QuizManagerDAO';
import { DATABASE_TYPE, USER_AUTHORIZATION } from '../Enums';

class ExpiryQuizRouter {
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
    this._router.get('/', ExpiryQuizRouter.getAll);

    this._router.post('/init', ExpiryQuizRouter.initQuiz);
    this._router.post('/quiz', ExpiryQuizRouter.postQuiz);
  }

  private static getAll(req: Request, res: Response): void {
    const quiz: IQuestionGroup = ExpiryQuizDAO.getCurrentQuestionGroup();
    const expiry: Date = ExpiryQuizDAO.expiry;

    res.json({
      quiz,
      expiry,
    });
  }

  private static initQuiz(req: Request, res: Response): void {
    const username = req.body.username;
    const token = req.body.token;
    const privateKey = req.body.privateKey;
    if (!privateKey || !token || !username || !LoginDAO.validateTokenForUser(username, token) || !LoginDAO.isUserAuthorizedFor(username,
      USER_AUTHORIZATION.CREATE_QUIZ_FROM_EXPIRED)) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.NOT_AUTHORIZED,
      }));

      return;
    }

    const baseQuiz = JSON.parse(JSON.stringify(ExpiryQuizDAO.storage));
    baseQuiz.hashtag = baseQuiz.hashtag + (
                       Object.keys(QuizManagerDAO.storage).length + 1
    );
    QuizManagerDAO.initInactiveQuiz(baseQuiz.hashtag);
    const readyQuiz = QuizManagerDAO.initActiveQuiz(baseQuiz);

    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: baseQuiz.hashtag,
      privateKey: privateKey,
    });

    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.INIT,
      payload: { questionGroup: readyQuiz.originalObject },
    });
  }

  private static postQuiz(req: Request, res: Response): void {
    const username = req.body.username;
    const token = req.body.token;
    if (!token || !username || !LoginDAO.validateTokenForUser(username, token) || !LoginDAO.isUserAuthorizedFor(username,
      USER_AUTHORIZATION.CREATE_EXPIRED_QUIZ)) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.NOT_AUTHORIZED,
      }));

      return;
    }

    if (!req.body.quiz || !req.body.expiry) {

      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.POST,
      }));

      return;
    }

    ExpiryQuizDAO.setQuestionGroup(req.body.quiz, new Date(req.body.expiry));

    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.POST,
    });
  }

}

// Create the ApiRouter, and export its configured Express.Router
const routes = new ExpiryQuizRouter();
const router = routes.router;
export { router };
