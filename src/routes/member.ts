import { IActiveQuiz } from 'arsnova-click-v2-types/dist/common';
import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import { NextFunction, Request, Response, Router } from 'express';
import QuizManagerDAO from '../db/QuizManagerDAO';
import { ActiveQuizItem } from '../quiz-manager/quiz-manager';

export class MemberRouter {
  get router(): Router {
    return this._router;
  }

  private readonly _router: Router;

  /**
   * Initialize the MemberRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public addMember(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);

    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }

    if (!req.body.nickname || (
      activeQuiz.originalObject.sessionConfig.nicks.restrictToCasLogin && !req.body.ticket
    )) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
      return;
    }

    try {
      const webSocketAuthorization: number = Math.random();
      if (!req.body.groupName) {
        req.body.groupName = 'Default';
      }

      const members = activeQuiz.memberGroups.find((
        value => value.name === req.body.groupName
      )).members;

      activeQuiz.addMember(req.body.nickname, webSocketAuthorization, req.body.groupName, req.body.ticket);

      res.send({
        status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
        step: COMMUNICATION_PROTOCOL.MEMBER.ADDED,
        payload: {
          member: members[members.length - 1].serialize(),
          memberGroups: activeQuiz.memberGroups.map(memberGroup => {
            return memberGroup.serialize();
          }),
          sessionConfiguration: activeQuiz.originalObject.sessionConfig,
          webSocketAuthorization: webSocketAuthorization,
        },
      });

    } catch (ex) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.MEMBER.ADDED,
        payload: { message: ex.message },
      }));
    }
  }

  public addReadingConfirmation(req: Request, res: Response): void {
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }
    activeQuiz.setReadingConfirmation(req.body.nickname);
    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.READING_CONFIRMATION_REQUESTED,
      payload: {},
    });
  }

  public addConfidenceValue(req: Request, res: Response): void {
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }
    activeQuiz.setConfidenceValue(req.body.nickname, req.body.confidenceValue);
    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.CONFIDENCE_VALUE_REQUESTED,
      payload: {},
    });
  }

  public deleteMember(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }
    const result: boolean = activeQuiz.removeMember(req.params.nickname);
    const response: Object = { status: result ? COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL : COMMUNICATION_PROTOCOL.STATUS.FAILED};
    if (result) {
      Object.assign(response, {
        step: COMMUNICATION_PROTOCOL.MEMBER.REMOVED,
        payload: {},
      });
    }
    res.send(response);
  }

  public getAllMembers(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }

    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.GET_PLAYERS,
      payload: {
        memberGroups: activeQuiz.memberGroups.map(memberGroup => memberGroup.serialize()),
      },
    });
  }

  public getRemainingNicks(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }
    const names: Array<String> = activeQuiz.originalObject.sessionConfig.nicks.selectedNicks.filter((nick) => {
      return !activeQuiz.memberGroups.find(memberGroup => {
        return !!memberGroup.members.find(value => value.name === nick);
      });
    });
    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.GET_REMAINING_NICKS,
      payload: { nicknames: names },
    });
  }

  public addResponse(req: Request, res: Response): void {
    if (!req.body.quizName || !req.body.nickname || !req.body.value) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
      return;
    }

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
      return;
    }

    activeQuiz.memberGroups.map(memberGroup => {
      if ((
        <ActiveQuizItem>activeQuiz
      ).findMemberByName(req.body.nickname).responses[activeQuiz.currentQuestionIndex].responseTime) {

        res.status(500);
        res.end(JSON.stringify({
          status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
          step: COMMUNICATION_PROTOCOL.MEMBER.DUPLICATE_RESPONSE,
          payload: {},
        }));
        return;
      }
    });

    if (typeof req.body.value === 'undefined') {
      res.status(500);
      res.end(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.MEMBER.INVALID_RESPONSE,
        payload: {},
      }));
      return;
    }

    activeQuiz.addResponseValue(req.body.nickname, req.body.value);

    res.send({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.UPDATED_RESPONSE,
      payload: {},
    });
  }

  public init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/:quizName', this.getAllMembers);
    this._router.get('/:quizName/available', this.getRemainingNicks);

    this._router.put('/', this.addMember);
    this._router.put('/reading-confirmation', this.addReadingConfirmation);
    this._router.put('/confidence-value', this.addConfidenceValue);
    this._router.put('/response', this.addResponse);

    this._router.delete('/:quizName/:nickname', this.deleteMember);

  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }
}

// Create the ApiRouter, and export its configured Express.Router
const memberRoutes = new MemberRouter();
const memberRouter = memberRoutes.router;
export { memberRouter };
