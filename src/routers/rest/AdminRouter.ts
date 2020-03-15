import { ObjectId } from 'bson';
import { Authorized, BodyParam, Delete, Get, JsonController, Param, Post, Put } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { UserRole } from '../../enums/UserRole';
import { IAdminQuiz } from '../../interfaces/quizzes/IAdminQuiz';
import { IUserSerialized } from '../../interfaces/users/IUserSerialized';
import { UserModel, UserModelItem } from '../../models/UserModelItem/UserModel';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/admin')
export class AdminRouter extends AbstractRouter {

  @Get('/users') //
  @Authorized(UserRole.SuperAdmin) //
  @OpenAPI({
    description: 'Returns all available users',
    security: [{ bearerAuth: [] }],
  })
  private getUsers(): Promise<Array<IUserSerialized>> {
    return UserModel.find().lean().exec() as Promise<Array<IUserSerialized>>;
  }

  @Delete('/user/:username') //
  @OpenAPI({
    description: 'Removes a given user',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async deleteUser(@Param('username') username: string): Promise<void> {
    await UserDAO.removeUser((await UserDAO.getUser(username)).id);
  }

  @Put('/user') //
  @OpenAPI({
    description: 'Adds a new user or updates an existing one',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async putUser(
    @BodyParam('originalUser', { required: false }) originalUser: string, //
    @BodyParam('name') name: string, //
    @BodyParam('privateKey') privateKey: string, //
    @BodyParam('passwordHash') passwordHash: string, //
    @BodyParam('userAuthorizations') userAuthorizations: Array<string>, //
    @BodyParam('gitlabToken', { required: false }) gitlabToken: string, //
  ): Promise<UserModelItem> {

    const userData: IUserSerialized = {
      name,
      passwordHash,
      privateKey,
      userAuthorizations,
      gitlabToken,
    };

    await UserModel.updateOne({ name: originalUser }, userData, {
      upsert: true,
      setDefaultsOnInsert: true,
    }).exec();

    return UserDAO.getUser(originalUser);
  }

  @Get('/quizzes') //
  @OpenAPI({
    description: 'Returns all available quizzes',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async getQuizzes(): Promise<Array<IAdminQuiz>> {
    return Promise.all((await QuizDAO.getAllQuizzes()).map(async quiz => {
      let questionAmount = 0;
      let answerAmount = 0;
      if (Array.isArray(quiz.questionList) && quiz.questionList.length) {
        questionAmount = quiz.questionList.length;
        answerAmount = quiz.questionList.map(question => question.answerOptionList.length)
        .reduce((previousValue, currentValue) => previousValue + currentValue);
      }
      const memberAmount = (
        await MemberDAO.getMembersOfQuiz(quiz.name)
      ).length;

      return {
        state: quiz.state,
        id: quiz._id.toHexString(),
        name: quiz.name,
        expiry: quiz.expiry,
        visibility: quiz.visibility,
        questionAmount,
        answerAmount,
        memberAmount,
      };
    }));
  }

  @Post('/quiz') //
  @OpenAPI({
    description: 'Deactivates a given quiz',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async updateQuizState(@BodyParam('quizname') quizname: string): Promise<void> {
    const quiz = await QuizDAO.getQuizByName(quizname);
    if (!quiz) {
      return;
    }

    await QuizDAO.setQuizAsInactive(quizname, quiz.privateKey);
  }

  @Get('/quiz/:id') //
  @OpenAPI({
    description: 'Returns an available quiz by the id',
    security: [{ bearerAuth: [] }],
  }) @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async getQuiz(@Param('id') quizId: string): Promise<object> {
    return (await QuizDAO.getQuizById(new ObjectId(quizId))).toJSON();
  }

  @Delete('/quiz/:quizName') //
  @OpenAPI({
    description: 'Removes a given quiz',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async deleteQuiz(@Param('quizName') quizName: string): Promise<void> {
    await QuizDAO.removeQuizByName(quizName);
  }
}
