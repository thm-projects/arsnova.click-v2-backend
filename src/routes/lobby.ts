import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import { NextFunction, Request, Response, Router } from 'express';
import QuizManagerDAO from '../db/QuizManagerDAO';
import { WebSocketRouter } from './websocket';

export class LobbyRouter {
  get router(): Router {
    return this._router;
  }

  private readonly _router: Router;

  /**
   * Initialize the LobbyRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public putOpenLobby(req: Request, res: Response): void {
    const messageToWSSClients = JSON.stringify({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.SET_ACTIVE,
      payload: {
        quizName: req.body.quiz.hashtag,
      },
    });
    WebSocketRouter.wss.clients.forEach(client => client.send(messageToWSSClients));

    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.OPENED,
      payload: {
        quiz: QuizManagerDAO.initActiveQuiz(req.body.quiz).serialize(),
      },
    });
  }

  public getLobbyData(req: Request, res: Response): void {
    const isInactive: boolean = QuizManagerDAO.isInactiveQuiz(req.params.quizName);
    const quiz = isInactive ? null : QuizManagerDAO.getActiveQuizByName(req.params.quizName).serialize();
    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: isInactive ? COMMUNICATION_PROTOCOL.LOBBY.CLOSED : COMMUNICATION_PROTOCOL.LOBBY.OPENED,
      payload: {
        quiz,
      },
    });
  }

  public deleteLobby(req: Request, res: Response): void {
    QuizManagerDAO.setQuizAsInactive(req.body.quizName);
    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.CLOSED,
      payload: {},
    });
  }

  public init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/:quizName', this.getLobbyData);

    this._router.put('/', this.putOpenLobby);

    this._router.delete('/', this.deleteLobby);
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }
}

// Create the ApiRouter, and export its configured Express.Router
const lobbyRoutes = new LobbyRouter();
const lobbyRouter = lobbyRoutes.router;
export { lobbyRouter };
