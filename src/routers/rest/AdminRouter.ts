import { Authorized, BodyParam, Delete, Get, JsonController, Param, Post, Put } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { default as DbDAO } from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { DbCollection } from '../../enums/DbOperation';
import { QuizState } from '../../enums/QuizState';
import { UserRole } from '../../enums/UserRole';
import { IAdminQuiz } from '../../interfaces/quizzes/IAdminQuiz';
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
  private getQuizzes(): Array<IAdminQuiz> {
    return QuizDAO.getAllQuizzes().map(quiz => {
      let questionAmount = 0;
      let answerAmount = 0;
      if (Array.isArray(quiz.questionList) && quiz.questionList.length) {
        questionAmount = quiz.questionList.length;
        answerAmount = quiz.questionList.map(question => question.answerOptionList.length)
        .reduce((previousValue, currentValue) => previousValue + currentValue);
      }

      return {
        state: quiz.state,
        id: quiz.id.toHexString(),
        name: quiz.name,
        expiry: quiz.expiry,
        visibility: quiz.visibility,
        questionAmount,
        answerAmount,
      };
    });
  }

  @Post('/quiz') //
  @OpenAPI({
    description: 'Deactivates a given quiz',
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  private async updateQuizState(@BodyParam('quizname') quizname: string): Promise<void> {
    const quiz = QuizDAO.getQuizByName(quizname);
    if (!quiz) {
      return;
    }

    DbDAO.updateOne(DbCollection.Quizzes, { _id: quiz.id }, { state: QuizState.Inactive });
    DbDAO.deleteMany(DbCollection.Members, { currentQuizName: quiz.name });

    quiz.onRemove();
  }

  @Get('/quiz/:id') //
  @OpenAPI({
    description: 'Returns an available quiz by the id',
  })
  private getQuiz(@Param('id') quizId: string): object {
    return QuizDAO.getQuizById(quizId).serialize();
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
