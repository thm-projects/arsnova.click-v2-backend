import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import { IQuestionGroup } from 'arsnova-click-v2-types/dist/questions/interfaces';
import { BadRequestError, BodyParam, Get, JsonController, Post, UnauthorizedError } from 'routing-controllers';
import { default as DbDAO } from '../../db/DbDAO';
import ExpiryQuizDAO from '../../db/ExpiryQuizDAO';
import LoginDAO from '../../db/LoginDAO';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { DATABASE_TYPE, USER_AUTHORIZATION } from '../../Enums';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/expiry-quiz')
export class ExpiryQuizRouter extends AbstractRouter {

  @Get('/')
  private getAll(): object {
    const quiz: IQuestionGroup = ExpiryQuizDAO.getCurrentQuestionGroup();
    const expiry: Date = ExpiryQuizDAO.expiry;

    return {
      quiz,
      expiry,
    };
  }

  @Post('/init')
  private initQuiz(
    @BodyParam('username') username: string, //
    @BodyParam('token') token: string, //
    @BodyParam('privateKey') privateKey: string,
  ): object {

    if (!privateKey || !token || !username || !LoginDAO.validateTokenForUser(username, token) || !LoginDAO.isUserAuthorizedFor(username,
      USER_AUTHORIZATION.CREATE_QUIZ_FROM_EXPIRED)) {
      throw new UnauthorizedError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.NOT_AUTHORIZED,
      }));
    }

    const baseQuiz = JSON.parse(JSON.stringify(ExpiryQuizDAO.storage));
    baseQuiz.hashtag = baseQuiz.hashtag + (Object.keys(QuizManagerDAO.storage).length + 1);
    QuizManagerDAO.initInactiveQuiz(baseQuiz.hashtag);
    const readyQuiz = QuizManagerDAO.initActiveQuiz(baseQuiz);

    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: baseQuiz.hashtag,
      privateKey: privateKey,
    });

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.INIT,
      payload: { questionGroup: readyQuiz.originalObject },
    };
  }

  @Post('/quiz')
  private postQuiz(
    @BodyParam('username') username: string, //
    @BodyParam('token') token: string, //
    @BodyParam('quiz') quiz: IQuestionGroup, //
    @BodyParam('expiry') expiry: string, //
  ): object {

    if (!token || !username || !LoginDAO.validateTokenForUser(username, token) || !LoginDAO.isUserAuthorizedFor(username,
      USER_AUTHORIZATION.CREATE_EXPIRED_QUIZ)) {
      throw new UnauthorizedError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.NOT_AUTHORIZED,
      }));
    }

    if (!quiz || !expiry) {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.POST,
      }));
    }

    ExpiryQuizDAO.setQuestionGroup(quiz, new Date(expiry));

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.POST,
    };
  }

}
