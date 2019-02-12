import * as WebSocket from 'ws';
import QuizDAO from '../../db/quiz/QuizDAO';
import { DbEvent } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { WebSocketStatus } from '../../enums/WebSocketStatus';
import { IMessage } from '../../interfaces/communication/IMessage';
import { IMemberEntity } from '../../interfaces/entities/Member/IMemberEntity';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { IGlobal } from '../../main';
import LoggerService from '../../services/LoggerService';

export class WebSocketRouter {
  private static _wss: WebSocket.Server;

  static get wss(): WebSocket.Server {
    return this._wss;
  }

  static set wss(value: WebSocket.Server) {
    this._wss = value;
    WebSocketRouter.init();
  }

  public static sendLobbyPlayerData(ws: WebSocket, message): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(message.payload.quizName);
    const res: any = { status: StatusProtocol.Success };
    if (!activeQuiz) {
      res.step = MessageProtocol.Inactive;
    } else {
      res.step = MessageProtocol.AllPlayers;
      res.payload = {
        members: activeQuiz.memberGroups.map((memberGroup) => {
          // TODO: this does strange stuff
          return memberGroup.members.map((nickname: IMemberEntity) => {
            return nickname.serialize();
          });
        }).reduce((previousValue, currentValue) => {
          return previousValue.concat(...currentValue);
        }),
      };
    }
    ws.send(JSON.stringify(res));
  }

  private static getWebSocketOpcode(match): string {
    const matchedValues = Object.values(WebSocketStatus).filter(value => WebSocketStatus[value] === match) as string[];
    return matchedValues.length ? matchedValues[0] : '[UNKNOWN]';
  }

  private static onPing(ws): void {
    ws.pong();
    ws['isAlive'] = true;
  }

  private static onPong(ws): void {
    ws['isAlive'] = true;
  }

  private static keepalive(): void {
    setInterval(() => {
      this.wss.clients.forEach(socket => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        if (socket['isAlive']) {
          socket['isAlive'] = false;
          socket.ping();
        } else {
          socket.close(WebSocketStatus.PolicyViolation);
        }
      });
    }, 30000);
  }

  private static init(): void {
    this.keepalive();

    WebSocketRouter._wss.on('connection', (ws: WebSocket) => {
      const quizStatusUpdateHandler = () => {
        WebSocketRouter.sendQuizStatusUpdate(ws, QuizDAO.getJoinableQuizzes().map(val => val.name));
      };
      ws['isAlive'] = true;

      ws.on('close', opcode => {
        this.disconnectFromChannel(ws);
        QuizDAO.updateEmitter.off(DbEvent.Change, quizStatusUpdateHandler.bind(this));
        LoggerService.info('Closing socket connection', opcode, `(${this.getWebSocketOpcode(opcode)})`);
      });
      ws.on('ping', this.onPing.bind(this, ws));
      ws.on('pong', this.onPong.bind(this, ws));
      ws.on('error', (err) => {
        WebSocketRouter.handleError(ws, err, '');
      });
      ws.on('message', (rawMessage: string | any) => {
        try {
          const message: IMessage = JSON.parse(rawMessage);

          switch (message.step) {
            case MessageProtocol.Connect:
              WebSocketRouter.connectToChannel(ws, message);
              break;
            case MessageProtocol.Disconnect:
              WebSocketRouter.disconnectFromChannel(ws);
              break;
            case MessageProtocol.GetPlayers:
              WebSocketRouter.sendLobbyPlayerData(ws, message);
              break;
          }

        } catch (ex) {
          WebSocketRouter.handleError(ws, ex, rawMessage);
        }
      });

      quizStatusUpdateHandler();
      QuizDAO.updateEmitter.on(DbEvent.Change, quizStatusUpdateHandler.bind(this));
    });
  }

  private static handleError(ws: WebSocket, ex: Error, rawMessage: string): void {
    LoggerService.info('error while receiving ws message', ex.message);
    (<IGlobal>global).createDump(ex);

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
      console.log('cannot send activequizzes to socket: no socket open', activeQuizzes);
      return;
    }
    console.log('sending activequizzes to socket', activeQuizzes);

    ws.send(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.Connected,
      payload: {
        activeQuizzes,
      },
    }));
  }

  private static connectToChannel(ws: WebSocket, message: IMessage): void {
    const quiz = QuizDAO.getQuizByName(message.payload.name);
    if (!quiz) {
      return;
    }

    quiz.addSocketToChannel(ws);
  }

  private static disconnectFromChannel(ws: WebSocket): void {
    const quiz = QuizDAO.getQuizBySocket(ws);
    if (!quiz) {
      return;
    }
    quiz.removeSocketFromChannel(ws);
  }
}
