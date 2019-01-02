import { Authorized, BadRequestError, BodyParam, Get, JsonController, Post } from 'routing-controllers';
import { default as DbDAO } from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { DbCollection } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { UserRole } from '../../enums/UserRole';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/expiry-quiz')
export class ExpiryQuizRouter extends AbstractRouter {

  @Get('/')
  private getAll(): object {
    const quiz: Array<IQuizEntity> = QuizDAO.getExpiryQuizzes();

    return {
      quiz,
    };
  }

  @Post('/init') //
  @Authorized(UserRole.CreateQuizFromExpired)
  private initQuiz(
    @BodyParam('quizname') quizname: string, //
    @BodyParam('username') username: string, //
    @BodyParam('privateKey') privateKey: string,
  ): object {

    const baseQuiz = QuizDAO.getExpiryQuizzes().find(val => val.name === quizname);
    baseQuiz.name = baseQuiz.name + (QuizDAO.getExpiryQuizzes().length + 1);
    QuizDAO.initQuiz(baseQuiz);
    const readyQuiz = QuizDAO.getQuizByName(baseQuiz.name);

    DbDAO.create(DbCollection.Quizzes, readyQuiz.serialize());

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Init,
      payload: { questionGroup: readyQuiz.serialize() },
    };
  }

  @Post('/quiz') //
  @Authorized(UserRole.CreateExpiredQuiz)
  private postQuiz(@BodyParam('quiz') quiz: IQuizEntity): object {

    if (!quiz) {
      throw new BadRequestError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.Post,
      }));
    }

    // TODO Add model insertion

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Post,
    };
  }

}
