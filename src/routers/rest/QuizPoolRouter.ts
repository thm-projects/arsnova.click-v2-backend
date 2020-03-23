import * as CryptoJS from 'crypto-js';
import { ObjectId } from 'mongodb';
import { Authorized, BadRequestError, BodyParam, Delete, Get, JsonController, Param, Post, Put } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import QuizDAO from '../../db/QuizDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { UserRole } from '../../enums/UserRole';
import { IMessage } from '../../interfaces/communication/IMessage';
import { IQuestion } from '../../interfaces/questions/IQuestion';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/quizpool')
export class QuizPoolRouter extends AbstractRouter {

  @Post('/generate') //
  public async generateAvailablePoolQuestions( //
    @BodyParam('data', { required: true }) data: Array<{ tag: string, amount: number }>, //
  ): Promise<IMessage> {
    const payload = await QuizDAO.getPoolQuestionsByTags(data);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Available,
      payload,
    };
  }

  @Get('/tags') //
  public async getAvailablePoolTags(): Promise<IMessage> {
    const tags = (
                   await QuizDAO.getPoolTags()
                 )[0] ?? {};
    const parsedTags = {};
    Object.keys(tags).forEach(key => {
      const parsedKey = key.toLowerCase()
      .split(' ')
      .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
      .join(' ');
      parsedTags[parsedKey] = tags[key];
    });

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Available,
      payload: parsedTags ?? {},
    };
  }

  @Post('/') //
  public async addNewPoolQuestion( //
    @BodyParam('question') question: IQuestion, //
    @BodyParam('origin', { required: false }) origin: string = 'quiz-pool', //
    @BodyParam('notificationMail', { required: false }) notificationMail?: string, //
  ): Promise<IMessage> {
    if (!question || !Array.isArray(question.tags) || !question.tags.length) {
      throw new BadRequestError('no valid question or tag list found');
    }

    const hash = CryptoJS.SHA3(JSON.stringify(question)).toString();
    const exists = await QuizDAO.getPoolQuestionByHash(hash);
    if (!exists) {
      await QuizDAO.addQuizToPool(question, hash, origin, notificationMail);
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Added,
      payload: {},
    };
  }

  @Get('/pending') //
  @OpenAPI({
    description: 'Returns all pending pool questions which have not yet been approved',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  public async getPendingPoolQuestions(): Promise<IMessage> {
    const questions = await QuizDAO.getPendingPoolQuestions();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Available,
      payload: questions.map(q => q.toJSON({ getters: true })),
    };
  }

  @Get('/all') //
  @OpenAPI({
    description: 'Returns all pool questions which have been approved already',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  public async getQuizpoolQuestions(): Promise<IMessage> {
    const question = await QuizDAO.getQuizpoolQuestions();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Available,
      payload: question?.map(q => q.toJSON({ getters: true })),
    };
  }

  @Get('/all/:id') //
  @OpenAPI({
    description: 'Returns a pool question by its id',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  public async getPendingPoolQuestionById(@Param('id') id: string): Promise<IMessage> {
    const question = await QuizDAO.getPoolQuestionById(new ObjectId(id));

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Available,
      payload: question?.toJSON({ getters: true }),
    };
  }

  @Delete('/:id') //
  @OpenAPI({
    description: 'Deletes a pool question by its id',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  public async deletePoolQuestion(@Param('id') id: string): Promise<IMessage> {
    await QuizDAO.removePoolQuestion(new ObjectId(id));

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Removed,
      payload: {},
    };
  }

  @Put('/pending') //
  @OpenAPI({
    description: 'Approves a pending pool question',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  public async approvePendingPoolQuestion( //
    @BodyParam('id') id: string, //
    @BodyParam('question', { required: false }) question: IQuestion, //
    @BodyParam('approved', { required: false }) approved: boolean, //
  ): Promise<IMessage> {
    if (!id) {
      throw new BadRequestError('no valid question id found');
    }

    const parsedId = new ObjectId(id);
    const exists = await QuizDAO.getPoolQuestionById(parsedId);
    if ((
          !question || !Array.isArray(question.tags)
        ) && !exists) {
      throw new BadRequestError('no valid question found');
    }

    let hash;
    if (question) {
      hash = CryptoJS.SHA3(JSON.stringify(question)).toString();
    }
    await QuizDAO.approvePoolQuestion(parsedId, question, hash, approved);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Updated,
      payload: {},
    };
  }
}
