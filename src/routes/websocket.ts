import { IActiveQuiz, IMessage, INickname } from 'arsnova-click-v2-types/dist/common';
import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import * as WebSocket from 'ws';
import { default as DbDAO } from '../db/DbDAO';
import QuizManagerDAO from '../db/QuizManagerDAO';
import { DATABASE_TYPE } from '../Enums';
import { IGlobal } from '../main';

export class WebSocketRouter {
  private static _wss: WebSocket.Server;

  static get wss(): WebSocket.Server {
    return this._wss;
  }

  static set wss(value: WebSocket.Server) {
    this._wss = value;
    WebSocketRouter.init();
  }

  private static init(): void {
    WebSocketRouter._wss.on('connection', (ws: WebSocket) => {
      ws.on('close', (code, message) => {
        console.log('ws closed', code, message);
      });
      ws.on('error', (err) => {
        WebSocketRouter.handleError(ws, err, '');
      });
      ws.on('message', (rawMessage: string | any) => {
        try {
          const message: IMessage = JSON.parse(rawMessage);

          switch (message.step) {
            case COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHENTICATE:
              WebSocketRouter.handleAuthentication(ws, message);
              break;
            case COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHENTICATE_AS_OWNER:
              WebSocketRouter.handleAuthenticationAsOwner(ws, message);
              break;
            case COMMUNICATION_PROTOCOL.LOBBY.GET_PLAYERS:
              WebSocketRouter.sendLobbyPlayerData(ws, message);
              break;
          }

        } catch (ex) {
          WebSocketRouter.handleError(ws, ex, rawMessage);
        }
      });

      WebSocketRouter.sendQuizStatusUpdate(ws, QuizManagerDAO.getAllJoinableQuizNames());
      QuizManagerDAO.quizStatusUpdateEmitter.on('update', activeQuizzes => {
        WebSocketRouter.sendQuizStatusUpdate(ws, activeQuizzes);
      });
    });
  }

  private static handleError(ws: WebSocket, ex: Error, rawMessage: string): void {
    console.log('error while receiving ws message', ex);
    (
      <IGlobal>global
    ).createDump(ex);

    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(JSON.stringify({
      status: `Exception raised`,
      message: rawMessage,
      exception: `${ex.message}`,
    }));
  }

  private static sendQuizStatusUpdate(ws: WebSocket, activeQuizzes: Array<string>): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(JSON.stringify({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.WEBSOCKET.CONNECTED,
      payload: {
        activeQuizzes,
      },
    }));
  }

  private static sendLobbyPlayerData(ws: WebSocket, message): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(message.payload.quizName);
    const res: any = { status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL };
    if (!activeQuiz) {
      res.step = COMMUNICATION_PROTOCOL.LOBBY.INACTIVE;
    } else {
      res.step = COMMUNICATION_PROTOCOL.LOBBY.ALL_PLAYERS;
      res.payload = {
        members: activeQuiz.memberGroups.map((memberGroup) => {
          return memberGroup.members.map((nickname: INickname) => {
            return nickname.serialize();
          });
        }).reduce((previousValue, currentValue) => {
          return previousValue.concat(...currentValue);
        }),
      };
    }
    ws.send(JSON.stringify(res));
  }

  private static handleAuthentication(ws: WebSocket, message: IMessage): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(message.payload.quizName);
    const res: IMessage = {
      status: null,
      step: null,
    };

    if (!activeQuiz) {
      res.status = COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL;
      res.step = COMMUNICATION_PROTOCOL.LOBBY.INACTIVE;
      ws.send(JSON.stringify(res));
    } else {
      activeQuiz.memberGroups.forEach((memberGroup) => {
        memberGroup.members.forEach(nickname => {
          if (nickname.webSocketAuthorization === parseFloat(message.payload.webSocketAuthorization)) {
            nickname.webSocket = ws;
            ws.send(JSON.stringify({
              status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
              step: COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHORIZED,
            }));
          }
        });
      });
    }
  }

  private static handleAuthenticationAsOwner(ws: WebSocket, message: IMessage): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(message.payload.quizName);
    const res: IMessage = {
      status: null,
      step: null,
    };

    if (!activeQuiz) {
      res.status = COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL;
      res.step = COMMUNICATION_PROTOCOL.LOBBY.INACTIVE;
      ws.send(JSON.stringify(res));
    } else {
      const isOwner: Object = DbDAO.read(DATABASE_TYPE.QUIZ, {
        quizName: message.payload.quizName,
        privateKey: message.payload.webSocketAuthorization,
      });
      if (isOwner && Object.keys(isOwner).length > 0) {
        activeQuiz.ownerSocket = ws;
        res.status = COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL;
        res.step = COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHORIZED;
        ws.send(JSON.stringify(res));
      } else {
        res.status = COMMUNICATION_PROTOCOL.STATUS.FAILED;
        res.step = COMMUNICATION_PROTOCOL.AUTHORIZATION.INSUFFICIENT_PERMISSIONS;
        ws.send(JSON.stringify(res));
      }
    }
  }
}
