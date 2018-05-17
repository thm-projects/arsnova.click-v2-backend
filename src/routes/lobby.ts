import {Router, Request, Response, NextFunction} from 'express';
import {QuizManagerDAO} from '../db/QuizManagerDAO';
import {WebSocketRouter} from './websocket';

export class LobbyRouter {
  get router(): Router {
    return this._router;
  }

  private _router: Router;

  /**
   * Initialize the LobbyRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }

  public putOpenLobby(req: Request, res: Response): void {
    const messageToWSSClients = JSON.stringify({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:SET_ACTIVE',
      payload: {
        quizName: req.body.quiz.hashtag
      }
    });
    WebSocketRouter.wss.clients.forEach(client => client.send(messageToWSSClients));

    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'LOBBY:OPENED',
      payload: {
        quiz: QuizManagerDAO.initActiveQuiz(req.body.quiz).serialize()
      }
    });
  }

  public getLobbyData(req: Request, res: Response): void {
    const isInactive: boolean = QuizManagerDAO.isInactiveQuiz(req.params.quizName);
    const quiz = isInactive ? null : QuizManagerDAO.getActiveQuizByName(req.params.quizName).serialize();
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: `LOBBY:${isInactive ? 'CLOSED' : 'OPENED'}`,
      payload: {
        quiz
      }
    });
  }

  public deleteLobby(req: Request, res: Response): void {
    QuizManagerDAO.setQuizAsInactive(req.body.quizName);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'LOBBY:CLOSED',
      payload: {}
    });
  }

  public init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/:quizName', this.getLobbyData);

    this._router.put('/', this.putOpenLobby);

    this._router.delete('/', this.deleteLobby);
  }
}

// Create the ApiRouter, and export its configured Express.Router
const lobbyRoutes = new LobbyRouter();
const lobbyRouter = lobbyRoutes.router;
export { lobbyRouter };
