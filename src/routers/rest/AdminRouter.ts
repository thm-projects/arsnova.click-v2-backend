import { Authorized, BodyParam, Delete, Get, JsonController, Param, Put } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { default as DbDAO } from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { DbCollection } from '../../enums/DbOperation';
import { UserRole } from '../../enums/UserRole';
import { IUserSerialized } from '../../interfaces/users/IUserSerialized';
import { UserModel } from '../../models/UserModelItem/UserModel';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/admin')
export class AdminRouter extends AbstractRouter {

  @Get('/users') //
  @OpenAPI({
    description: 'Returns all available users',
  })
  private getUsers(): object {
    return Object.values(UserDAO.storage).map(user => user.serialize());
  }

  @Delete('/user/:username') //
  @OpenAPI({
    description: 'Removes a given user',
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private deleteUser(@Param('username') username: string): void {
    UserDAO.removeUser(UserDAO.getUser(username).id);
  }

  @Put('/user') //
  @OpenAPI({
    description: 'Adds a new user or updates an existing one',
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private putUser(
    @BodyParam('originalUser', { required: false }) originalUser: string, //
    @BodyParam('name') name: string, //
    @BodyParam('privateKey') privateKey: string, //
    @BodyParam('passwordHash') passwordHash: string, //
    @BodyParam('userAuthorizations') userAuthorizations: Array<string>, //
    @BodyParam('gitlabToken', { required: false }) gitlabToken: string, //
  ): void {

    const userData: IUserSerialized = {
      name,
      passwordHash,
      privateKey,
      userAuthorizations,
      gitlabToken,
    };
    const userValidator = new UserModel(userData);
    const result = userValidator.validateSync();
    if (result) {
      throw result;
    }

    if (originalUser && UserDAO.getUser(originalUser)) {
      DbDAO.updateOne(DbCollection.Users, { name: originalUser }, userData);
      return;
    }

    userValidator.save();
  }

  @Get('/quizzes') //
  @OpenAPI({
    description: 'Returns all available quizzes',
  })
  private getQuizzes(): object {
    return QuizDAO.getAllQuizzes().map(quiz => quiz.serialize());
  }

  @Delete('/quiz/:quizName') //
  @OpenAPI({
    description: 'Removes a given quiz',
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async deleteQuiz(@Param('quizName') quizName: string): Promise<void> {
    await DbDAO.deleteOne(DbCollection.Quizzes, {
      name: quizName,
    });
  }
}
