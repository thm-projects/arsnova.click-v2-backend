import { Authorized, BadRequestError, BodyParam, Get, JsonController, Post } from 'routing-controllers';
import QuizDAO from '../../db/quiz/QuizDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { UserRole } from '../../enums/UserRole';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/expiry-quiz')
export class ExpiryQuizRouter extends AbstractRouter {

  @Get('/')
  private async getAll(): Promise<object> {
    const quiz: Array<QuizModelItem> = (await QuizDAO.getExpiryQuizzes()).map(expiryQuiz => expiryQuiz.toJSON());

    return {
      quiz,
    };
  }

  @Post('/init') //
  @Authorized(UserRole.CreateQuizFromExpired)
  private async initQuiz(
    @BodyParam('quizname') quizname: string, //
    @BodyParam('username') username: string, //
    @BodyParam('privateKey') privateKey: string,
  ): Promise<object> {

    const expiryQuizzes = await QuizDAO.getExpiryQuizzes();
    const baseQuiz: any = expiryQuizzes.find(val => val.name === quizname);
    baseQuiz.name = baseQuiz.name + (expiryQuizzes.length + 1);
    delete baseQuiz._id;

    const doc = await QuizDAO.addQuiz(baseQuiz);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Init,
      payload: { questionGroup: doc.toJSON() },
    };
  }

  @Post('/quiz') //
  @Authorized(UserRole.CreateExpiredQuiz)
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
