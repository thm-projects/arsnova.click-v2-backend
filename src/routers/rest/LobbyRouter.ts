import { BodyParam, Delete, Get, JsonController, Param, Put } from 'routing-controllers';
import AMQPConnector from '../../db/AMQPConnector';
import DbDAO from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { DbCollection } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuizState } from '../../enums/QuizState';
import { IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { QuizModel } from '../../models/quiz/QuizModelItem';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/lobby')
export class LobbyRouter extends AbstractRouter {

  @Put('/')
  private async putOpenLobby( //
    @BodyParam('quiz') quiz: IQuizSerialized, //
    @BodyParam('privateKey') privateKey: string, //
  ): Promise<object> {

    AMQPConnector.channel.publish('global', '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetActive,
      payload: {
        quizName: quiz.name,
      },
    })));

    quiz.state = QuizState.Active;
    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    const addedQuiz = QuizDAO.getQuizByName(quiz.name);
    if (addedQuiz) {
      DbDAO.updateOne(DbCollection.Quizzes, { _id: addedQuiz.id }, quiz);
    } else {
      const quizValidator = new QuizModel(quiz);
      const result = quizValidator.validateSync();
      if (result) {
        throw result;
      }
      await quizValidator.save();
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Opened,
    };
  }

  @Get('/:quizName')
  private getLobbyData(@Param('quizName') quizName: string, //
  ): object {

    const isActive = QuizDAO.isActiveQuiz(quizName);
    const quiz = isActive ? QuizDAO.getActiveQuizByName(quizName).serialize() : null;

    return {
      status: StatusProtocol.Success,
      step: isActive ? MessageProtocol.Opened : MessageProtocol.Closed,
      payload: {
        quiz,
      },
    };
  }

  @Delete('/')
  private deleteLobby(@BodyParam('quizName') quizName: string, //
  ): object {

    const addedQuiz = QuizDAO.getQuizByName(quizName);
    if (addedQuiz) {
      DbDAO.updateOne(DbCollection.Quizzes, { _id: addedQuiz.id }, { state: QuizState.Inactive });
    }

    AMQPConnector.channel.publish('global', '.*', Buffer.from(JSON.stringify({
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
