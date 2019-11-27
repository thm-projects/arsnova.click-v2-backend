import { BodyParam, Delete, Get, JsonController, Param, Put } from 'routing-controllers';
import AMQPConnector from '../../db/AMQPConnector';
import QuizDAO from '../../db/quiz/QuizDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuizState } from '../../enums/QuizState';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/lobby')
export class LobbyRouter extends AbstractRouter {

  @Put('/')
  private async putOpenLobby( //
    @BodyParam('quiz') quiz: QuizModelItem, //
    @BodyParam('privateKey') privateKey: string, //
  ): Promise<object> {

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetActive,
      payload: {
        quizName: quiz.name,
      },
    })));

    quiz.state = QuizState.Active;
    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;

    const addedQuiz = await QuizDAO.getQuizByName(quiz.name);
    if (addedQuiz) {
      await QuizDAO.updateQuiz(addedQuiz._id, quiz);
    } else {
      await QuizDAO.addQuiz(quiz);
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Opened,
    };
  }

  @Get('/:quizName')
  private async getLobbyData(@Param('quizName') quizName: string, //
  ): Promise<object> {

    const isActive = QuizDAO.isActiveQuiz(quizName);
    const quiz = isActive ? (await QuizDAO.getActiveQuizByName(quizName)).toJSON() : null;

    return {
      status: StatusProtocol.Success,
      step: isActive ? MessageProtocol.Opened : MessageProtocol.Closed,
      payload: {
        quiz,
      },
    };
  }

  @Delete('/')
  private async deleteLobby(@BodyParam('quizName') quizName: string, //
  ): Promise<object> {

    const addedQuiz = await QuizDAO.getQuizByName(quizName);
    if (addedQuiz) {
      await QuizDAO.updateQuiz(addedQuiz._id, { state: QuizState.Inactive });
    }

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetInactive,
      payload: {
        quizName,
      },
    })));

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Closed,
      payload: {},
    };
  }

  @Get('/')
  private getAll(): object {
    return {};
  }
}
