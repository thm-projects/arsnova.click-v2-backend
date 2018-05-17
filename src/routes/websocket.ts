import * as WebSocket from 'ws';
import {IActiveQuiz, INickname} from 'arsnova-click-v2-types/src/common';
import {DatabaseTypes, DbDao} from '../db/DbDAO';
import {QuizManagerDAO} from '../db/QuizManagerDAO';

export class WebSocketRouter {
  static get wss(): WebSocket.Server {
    return this._wss;
  }

  static set wss(value: WebSocket.Server) {
    this._wss = value;
    WebSocketRouter.init();
  }
  private static _wss: WebSocket.Server;

  private static init(): void {
    WebSocketRouter._wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (message: string | any) => {
        try {
          message = JSON.parse(message);

          if (message.step === 'WEBSOCKET:AUTHORIZE') {
            const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(message.payload.quizName);
            const res = {status: '', step: ''};

            if (!activeQuiz) {
              res.status = 'STATUS:SUCCESSFUL';
              res.step = 'LOBBY:INACTIVE';
              ws.send(JSON.stringify(res));
            } else {
              activeQuiz.memberGroups.forEach((memberGroup) => {
                memberGroup.members.forEach(nickname => {
                  if (nickname.webSocketAuthorization === parseFloat(message.payload.webSocketAuthorization)) {
                    nickname.webSocket = ws;
                    ws.send(JSON.stringify({status: 'STATUS:SUCCESSFUL', step: 'WEBSOCKET:AUTHORIZED'}));
                  }
                });
              });
            }
          }

          if (message.step === 'WEBSOCKET:AUTHORIZE_AS_OWNER') {
            const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(message.payload.quizName);
            const res = {status: '', step: ''};

            if (!activeQuiz) {
              res.status = 'STATUS:SUCCESSFUL';
              res.step = 'LOBBY:INACTIVE';
              ws.send(JSON.stringify(res));
            } else {
              const isOwner: Object = DbDao.read(DatabaseTypes.quiz, {
                quizName: message.payload.quizName,
                privateKey: message.payload.webSocketAuthorization
              });
              if (Object.keys(isOwner).length > 0) {
                activeQuiz.ownerSocket = ws;
                res.status = 'STATUS:SUCCESSFUL';
                res.step = 'WEBSOCKET:AUTHORIZED';
                ws.send(JSON.stringify(res));
              } else {
                res.status = 'STATUS:FAILED';
                res.step = 'INSUFFICIENT_PERMISSIONS';
                ws.send(JSON.stringify(res));
              }
            }
          }

          if (message.step === 'LOBBY:GET_PLAYERS') {
            const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(message.payload.quizName);
            const res: any = {status: 'STATUS:SUCCESSFUL'};
            if (!activeQuiz) {
              res.step = 'LOBBY:INACTIVE';
            } else {
              res.step = 'LOBBY:ALL_PLAYERS';
              res.payload = {
                members: activeQuiz.memberGroups.map((memberGroup) => {
                  return memberGroup.members.map((nickname: INickname) => {
                    return nickname.serialize();
                  });
                }).reduce((previousValue, currentValue) => {
                  return previousValue.concat(...currentValue);
                })
              };
            }
            ws.send(JSON.stringify(res));
          }

        } catch (ex) {
          console.log('error while receiving ws message', ex);
          ws.send(JSON.stringify({
            status: `Exception raised`,
            message,
            exception: `${ex.message}`
          }));
        }
      });
      ws.on('close', (code, message) => {
        console.log('ws closed', code, message);
      });
      ws.on('error', (err) => {
        console.log('ws error', err);
      });

      ws.send(JSON.stringify({status: 'STATUS:SUCCESSFUL', step: 'CONNECTED', payload: {
        activeQuizzes: QuizManagerDAO.getAllActiveQuizNames()
      }}));
    });
  }
}
