import { ObjectId } from 'bson';
import { Document } from 'mongoose';
import { PushSubscription, sendNotification, WebPushError } from 'web-push';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { IQuestion } from '../interfaces/questions/IQuestion';
import { QuizPoolModel, QuizPoolModelItem } from '../models/quiz/QuizPoolModelItem';
import LoggerService from '../services/LoggerService';
import { AbstractDAO } from './AbstractDAO';
import AMQPConnector from './AMQPConnector';

class QuizPoolDAO extends AbstractDAO {

  public static getInstance(): QuizPoolDAO {
    if (!this.instance) {
      this.instance = new QuizPoolDAO();
    }

    return this.instance;
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    return {
      questions: await QuizPoolModel.countDocuments({}),
      pendingQuestionAmount: await this.getPendingPoolQuestionsAmount(),
      tags: Object.keys((
                          await this.getPoolTags()
                        )[0] ?? {}).length,
    };
  }

  public async getPoolQuestionsByTags(data: Array<{ tag: string, amount: number }>): Promise<Array<object>> {
    return Promise.all(data.map(value => {
      const sampleQuery: any = {};
      if (value.amount) {
        sampleQuery.$sample = { size: value.amount };
      }

      return QuizPoolModel.aggregate([
        { $match: { approved: true, 'question.tags': new RegExp(value.tag, 'i') } }, //
        { $project: { question: 1 } }, //
        sampleQuery,
      ]);
    })).then(values => {
      return values.reduce((previousValue, currentValue) => previousValue.concat(...currentValue.map(cv => (
        { _id: cv._id.toHexString(), question: cv.question }
      ))), [])
      .filter((value, index, array) => array.findIndex(arrayElem => value._id === arrayElem._id) === index).map(value => value.question);
    });
  }

  public async getPoolTags(): Promise<Array<object>> {
    return QuizPoolModel.aggregate([
      { $match: { approved: true } }, //
      { $project: { _id: 0, 'question.tags': 1 } }, //
      { $unwind: '$question.tags' }, //
      { $group: { _id: { '$toLower': { '$trim': { input: '$question.tags' } } }, count: { '$sum': 1 } } }, //
      { $sort: { count: -1 } }, //
      { $group: { _id: null, counts: { $push: { k: '$_id', v: '$count' } } } }, //
      { $replaceRoot: { newRoot: { $arrayToObject: '$counts' } } }, //
    ]).exec();
  }

  public async getPendingPoolQuestions(): Promise<Array<Document & QuizPoolModelItem>> {
    return QuizPoolModel.find({ approved: false }).exec();
  }

  public async getPendingPoolQuestionsAmount(): Promise<number> {
    return QuizPoolModel.countDocuments({ approved: false }).exec();
  }

  public async removePoolQuestion(id: ObjectId): Promise<void> {
    await QuizPoolModel.findOneAndDelete({ _id: id }).exec();
    AMQPConnector.sendRequestStatistics();

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdateBadgeAmount,
      payload: {
        target: 'admin',
        amount: await this.getPendingPoolQuestionsAmount(),
      },
    })));
  }

  public async getPoolQuestionById(id: ObjectId): Promise<Document & QuizPoolModelItem> {
    return QuizPoolModel.findOne({ _id: id }).exec();
  }

  public async getQuizpoolQuestions(): Promise<Array<Document & QuizPoolModelItem>> {
    return QuizPoolModel.find({ approved: true }).exec();
  }

  public async approvePoolQuestion(id: ObjectId, question?: IQuestion, hash?: string, approved?: boolean, subscription?: PushSubscriptionJSON): Promise<void> {
    const query: Partial<QuizPoolModelItem> = {};
    if (typeof approved !== 'undefined' && approved !== null) {
      query.approved = approved;
    }
    if (question) {
      query.approved = false;
      query.question = question;
      query.hash = hash;
      query.contentHash = this.generateHashFromPoolQuestion(question);
    }

    if (Object.keys(query).length === 0) {
      throw new Error('Either approved flag or an updated question must be set');
    }

    await QuizPoolModel.updateOne({ _id: id }, query).exec();

    AMQPConnector.sendRequestStatistics();
    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdateBadgeAmount,
      payload: {
        target: 'footerElemQuizpool',
        amount: await this.getPendingPoolQuestionsAmount(),
      },
    })));

    if (!subscription) {
      return;
    }

    sendNotification(subscription as PushSubscription, JSON.stringify({
      step: MessageProtocol.PoolQuestionApproved,
      payload: {},
    })).catch(reason => {
      if (reason instanceof WebPushError && [404, 410].includes(reason.statusCode)) {
        LoggerService.info('Cannot send Quiz Pool approval notification since the target is not reachable');
      }
    });
  }

  public async getPoolQuestionByHash(hash: string): Promise<Document & QuizPoolModelItem> {
    return QuizPoolModel.findOne({ hash });
  }

  public async addQuizToPool(question: IQuestion, hash: string, origin: string, subscription?: PushSubscriptionJSON): Promise<Document & QuizPoolModelItem> {
    const result = await QuizPoolModel.create({
      approved: false,
      question,
      hash,
      contentHash: this.generateHashFromPoolQuestion(question),
      origin,
      subscription,
    });

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdateBadgeAmount,
      payload: {
        target: 'admin',
        amount: await this.getPendingPoolQuestionsAmount(),
      },
    })));

    return result;
  }

  public addQuestions(payload: Array<QuizPoolModelItem>): Promise<Array<Document & QuizPoolModelItem>> {
    payload = payload.map(pl => (
      {
        approved: pl.approved,
        origin: pl.origin,
        question: pl.question,
        contentHash: pl.contentHash,
        hash: pl.hash,
      }
    ));
    const result = QuizPoolModel.insertMany(payload, { ordered: false });

    AMQPConnector.sendRequestStatistics();

    return result;
  }

  private generateHashFromPoolQuestion(question: IQuestion): Partial<{ [key in keyof IQuestion]: string }> {
    return {
      questionText: Buffer.from(question.questionText).toString('base64'),
      answerOptionList: Buffer.from(JSON.stringify(question.answerOptionList)).toString('base64'),
      tags: Buffer.from(question.tags.sort().join()).toString('base64'),
    };
  }
}

export default QuizPoolDAO.getInstance();
