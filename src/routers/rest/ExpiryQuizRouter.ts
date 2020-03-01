import { Document } from 'mongoose';
import { Authorized, BadRequestError, BodyParam, Get, JsonController, Post } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import QuizDAO from '../../db/QuizDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { UserRole } from '../../enums/UserRole';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/expiry-quiz')
export class ExpiryQuizRouter extends AbstractRouter {

  @Get('/') //
  @Authorized(UserRole.CreateQuizFromExpired) //
  @OpenAPI({
    summary: 'Returns all quizzes with expiry date',
    security: [{ bearerAuth: [] }],
    deprecated: true,
  })
  private async getAll(): Promise<object> {
    const quiz: Array<QuizModelItem> = (
      await QuizDAO.getExpiryQuizzes()
    ).map(expiryQuiz => expiryQuiz.toJSON());

    return {
      quiz,
    };
  }

  @Post('/init') //
  @Authorized(UserRole.CreateQuizFromExpired) //
  @OpenAPI({
    summary: 'Initializes a quiz with expiry date',
    security: [{ bearerAuth: [] }],
    deprecated: true,
  })
  private async initQuiz(
    @BodyParam('quizname') quizname: string, //
    @BodyParam('username') username: string, //
    @BodyParam('privateKey') privateKey: string,
  ): Promise<object> {

    const expiryQuizzes = await QuizDAO.getExpiryQuizzes();
    const baseQuiz: Document & QuizModelItem = expiryQuizzes.find(val => val.name === quizname);
    baseQuiz.name = baseQuiz.name + (expiryQuizzes.length + 1);

    const doc = await QuizDAO.addQuiz(baseQuiz.toJSON());

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Init,
      payload: { questionGroup: doc.toJSON() },
    };
  }

  @Post('/quiz') //
  @Authorized(UserRole.CreateExpiredQuiz) //
  @OpenAPI({
    summary: 'Creates a new quiz with expiry date',
    security: [{ bearerAuth: [] }],
    deprecated: true,
  })
  private postQuiz(@BodyParam('quiz') quiz: IQuiz): object {

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
