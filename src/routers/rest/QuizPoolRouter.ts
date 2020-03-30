import * as CryptoJS from 'crypto-js';
import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { Authorized, BadRequestError, BodyParam, Delete, Get, JsonController, Param, Post, Put, Req } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import * as superagent from 'superagent';
import QuizPoolDAO from '../../db/QuizPoolDAO';
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
    const payload = await QuizPoolDAO.getPoolQuestionsByTags(data);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Available,
      payload,
    };
  }

  @Get('/tags') //
  public async getAvailablePoolTags(): Promise<IMessage> {
    const tags = (
                   await QuizPoolDAO.getPoolTags()
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

  @Post('/import') //
  @OpenAPI({
    description: 'Imports all pool questions which have been approved already from a remote arsnova.click server',
    security: [{ bearerAuth: [] }],
  }) //
  @Authorized([UserRole.QuizAdmin, UserRole.SuperAdmin])
  public async initiateImport( //
    @BodyParam('url') url: string, //
    @Req() request: Request, //
  ): Promise<IMessage> {
    if (!url) {
      throw new BadRequestError('url not found');
    }

    return superagent.get(`${url}/api/v1/quizpool/all`) //
    .set('Authorization', request.header('authorization')) //
    .then(result => QuizPoolDAO.addQuestions(result.body.payload)) //
    .then(data => {
      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Added,
        payload: data.map(val => val.toJSON({ getters: true })),
      };
    })
    .catch(error => {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.InvalidResponse,
        payload: error,
      };
    });
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
    const exists = await QuizPoolDAO.getPoolQuestionByHash(hash);
    if (!exists) {
      await QuizPoolDAO.addQuizToPool(question, hash, origin, notificationMail);
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
    const questions = await QuizPoolDAO.getPendingPoolQuestions();

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
    const question = await QuizPoolDAO.getQuizpoolQuestions();

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
    const question = await QuizPoolDAO.getPoolQuestionById(new ObjectId(id));

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
    await QuizPoolDAO.removePoolQuestion(new ObjectId(id));

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
    const exists = await QuizPoolDAO.getPoolQuestionById(parsedId);
    if ((
          !question || !Array.isArray(question.tags)
        ) && !exists) {
      throw new BadRequestError('no valid question found');
    }

    let hash;
    if (question) {
      hash = CryptoJS.SHA3(JSON.stringify(question)).toString();
    }
    await QuizPoolDAO.approvePoolQuestion(parsedId, question, hash, approved);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Updated,
      payload: {},
    };
  }
}
