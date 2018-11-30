import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import { IQuestionGroup } from 'arsnova-click-v2-types/dist/main';
import { BodyParam, Delete, Get, JsonController, Param, Put } from 'routing-controllers';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { WebSocketRouter } from '../websocket/WebSocketRouter';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/lobby')
export class LobbyRouter extends AbstractRouter {

  @Put('/')
  private putOpenLobby( //
    @BodyParam('quiz') quiz: IQuestionGroup, //
  ): object {

    const messageToWSSClients = JSON.stringify({
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.SET_ACTIVE,
      payload: {
        quizName: quiz.hashtag,
      },
    });
    WebSocketRouter.wss.clients.forEach(client => client.send(messageToWSSClients));

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.OPENED,
      payload: {
        quiz: QuizManagerDAO.initActiveQuiz(quiz).serialize(),
      },
    };
  }

  @Get('/:quizName')
  private getLobbyData(@Param('quizName') quizName: string, //
  ): object {

    const isInactive: boolean = QuizManagerDAO.isInactiveQuiz(quizName);
    const quiz = isInactive ? null : QuizManagerDAO.getActiveQuizByName(quizName).serialize();

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: isInactive ? COMMUNICATION_PROTOCOL.LOBBY.CLOSED : COMMUNICATION_PROTOCOL.LOBBY.OPENED,
      payload: {
        quiz,
      },
    };
  }

  @Delete('/')
  private deleteLobby(@BodyParam('quizName') quizName: string, //
  ): object {

    QuizManagerDAO.setQuizAsInactive(quizName);

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.CLOSED,
      payload: {},
    };
  }

  @Get('/')
  private getAll(): object {
    return {};
  }
}
