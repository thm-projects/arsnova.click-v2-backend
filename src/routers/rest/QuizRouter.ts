import { Request, Response } from 'express';
import * as fs from 'fs';
import { Document } from 'mongoose';
import * as path from 'path';
import * as routeCache from 'route-cache';
import {
  BadRequestError,
  BodyParam,
  ContentType,
  Delete,
  Get,
  HeaderParam,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
  Params,
  Post,
  Put,
  Res,
  UnauthorizedError,
  UploadedFiles,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import AMQPConnector from '../../db/AMQPConnector';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { AnswerState } from '../../enums/AnswerState';
import { IPCExchange } from '../../enums/IPCExchange';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuestionType } from '../../enums/QuestionType';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { RoutingCache } from '../../enums/RoutingCache';
import { UserRole } from '../../enums/UserRole';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IMessage } from '../../interfaces/communication/IMessage';
import { IAnswerResult } from '../../interfaces/IAnswerResult';
import { IQuizStatusPayload } from '../../interfaces/IQuizStatusPayload';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { asyncForEach } from '../../lib/async-for-each';
import { MatchAssetCachedQuiz, MatchTextToAssetsDb } from '../../lib/cache/assets';
import { Leaderboard } from '../../lib/leaderboard/leaderboard';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import LoggerService from '../../services/LoggerService';
import { publicSettings, settings } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/quiz')
export class QuizRouter extends AbstractRouter {

  @Get('/answer-result')
  public async getAnswerResult(
    @HeaderParam('authorization', { required: true }) token: string, //
  ): Promise<IAnswerResult> {
    const attendee = await MemberDAO.getMemberByToken(token);
    if (!attendee) {
      throw new UnauthorizedError();
    }
    const quiz = await QuizDAO.getActiveQuizByName(attendee.currentQuizName);
    if (!quiz) {
      throw new BadRequestError();
    }

    return Leaderboard.getAnswerResult(attendee, quiz);
  }

  @Get('/bonus-token')
  public async getCanUseBonusToken(
    @HeaderParam('authorization', { required: true }) token: string, //
  ): Promise<boolean> {
    const attendee = await MemberDAO.getMemberByToken(token);
    if (!attendee) {
      throw new UnauthorizedError();
    }
    const quiz = await QuizDAO.getActiveQuizByName(attendee.currentQuizName);
    if (!quiz || quiz.currentQuestionIndex < quiz.questionList.length - 1) {
      return false;
    }
    const canNotUseToken = quiz.questionList.some((value, index) => {
      return ![QuestionType.ABCDSurveyQuestion, QuestionType.SurveyQuestion].includes(value.TYPE) &&
             value.requiredForToken &&
             Leaderboard.getAnswerStateForResponse(attendee.responses[index].value, value) !== AnswerState.Wrong;
    });
    return !canNotUseToken;
  }

  @Get('/status/:quizName?') //
  @OpenAPI({
    summary: 'Returns the status of a quiz',
    parameters: [
      {
        name: 'quizName',
        in: 'path',
        required: false,
      },
    ],
  })
  @UseBefore(routeCache.cacheSeconds(5, req => `${RoutingCache.QuizStatus}_${req.params.quizName}`))
  public async getIsAvailableQuiz(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): Promise<IMessage> {

    const quizName = params.quizName;
    const member = await MemberDAO.getMemberByToken(token);

    if (!quizName && (
      !token || !member
    )) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz = await QuizDAO.getQuizByName(quizName || member.currentQuizName);
    const payload: IQuizStatusPayload = {};

    if (quiz) {
      if ([QuizState.Active, QuizState.Running].includes(quiz.state)) {
        payload.provideNickSelection = quiz.sessionConfig.nicks.selectedNicks.length > 0;
        payload.authorizeViaCas = quiz.sessionConfig.nicks.restrictToCasLogin;
        payload.maxMembersPerGroup = quiz.sessionConfig.nicks.maxMembersPerGroup;
        payload.autoJoinToGroup = quiz.sessionConfig.nicks.autoJoinToGroup;
        payload.memberGroups = quiz.sessionConfig.nicks.memberGroups;
        payload.startTimestamp = quiz.currentStartTimestamp;
        payload.readingConfirmationRequested = quiz.readingConfirmationRequested;
      }

      payload.name = quiz.name;
      payload.state = quiz.state;
    }

    return {
      status: StatusProtocol.Success,
      step: quiz ? //
            [QuizState.Active, QuizState.Running].includes(quiz.state) ? //
            MessageProtocol.Available : //
            quiz.privateKey === token ? //
            MessageProtocol.Editable : //
            MessageProtocol.AlreadyTaken : //
            MessageProtocol.Unavailable, //
      payload,
    };
  }

  @Get('/full-status/:quizName') //
  @OpenAPI({
    summary: 'Returns the quiz state and content',
    parameters: [
      {
        name: 'quizName',
        in: 'path',
        required: false,
      },
    ],
  })
  @UseBefore(routeCache.cacheSeconds(5, req => `${RoutingCache.QuizFullStatus}_${req.params.quizName}`))
  public async getFullQuizStatusData(
    @Params() params: { [key: string]: any }, //
  ): Promise<object> {
    const quiz = await QuizDAO.getQuizForAttendee(params.quizName);
    if (!quiz) {
      throw new NotFoundError(`Quiz with name ${params.quizName} not found`);
    }

    const step = [QuizState.Active, QuizState.Running].includes(quiz.state) ? MessageProtocol.Available : MessageProtocol.Unavailable;
    const payload: { quiz?: QuizModelItem, status?: { authorizeViaCas: boolean, provideNickSelection: boolean } } = {};
    if (step === MessageProtocol.Available) {
      payload.quiz = quiz.toJSON();
      payload.status = {
        authorizeViaCas: quiz.sessionConfig.nicks.restrictToCasLogin,
        provideNickSelection: quiz.sessionConfig.nicks.selectedNicks.length > 0,
      };
    }

    return {
      status: StatusProtocol.Success,
      step,
      payload,
    };
  }

  @Get('/generate/demo/:languageId') //
  @ContentType('application/json')
  public async generateDemoQuiz(
    @Param('languageId') languageId: string, //
    @Res() res: Response, //
  ): Promise<IQuiz> {

    try {
      const basePath = path.join(settings.pathToAssets, 'predefined_quizzes', 'demo_quiz');
      let demoQuizPath = path.join(basePath, `${languageId.toLowerCase()}.demo_quiz.json`);
      if (!fs.existsSync(demoQuizPath)) {
        demoQuizPath = path.join(basePath, 'en.demo_quiz.json');
      }

      const result: IQuiz = JSON.parse(fs.readFileSync(demoQuizPath).toString());
      const lastPersistedDemoQuizNumber = await QuizDAO.getLastPersistedDemoQuizNumber();
      result.name = 'Demo Quiz ' + (
                    lastPersistedDemoQuizNumber + 1
      );
      await QuizDAO.convertLegacyQuiz(result);

      return result;

    } catch (ex) {
      console.error('File IO Error', ex.message);
      throw new InternalServerError(`File IO Error: ${ex}`);
    }
  }

  @Get('/generate/abcd/:languageId/:answerLength?') //
  @OpenAPI({
    summary: 'Generates a new abcd quiz with the passed language and number of answers',
    parameters: [
      {
        name: 'languageId',
        in: 'path',
        required: true,
      },
      {
        name: 'answerLength',
        in: 'path',
        required: false,
      },
    ],
  }) //
  @ContentType('application/json')
  public async generateAbcdQuiz(
    @Param('languageId') languageId: string, //
    @Param('answerLength') answerLength: number, //
    @Res() res: Response, //
  ): Promise<IQuiz> {

    try {
      answerLength = parseInt(String(answerLength), 10) || 4;
      const basePath = path.join(settings.pathToAssets, 'predefined_quizzes', 'abcd_quiz');
      let abcdQuizPath = path.join(basePath, `${languageId.toLowerCase()}.abcd_quiz.json`);
      if (!fs.existsSync(abcdQuizPath)) {
        abcdQuizPath = path.join(basePath, 'en.abcd_quiz.json');
      }

      const result: IQuiz = JSON.parse(fs.readFileSync(abcdQuizPath).toString());
      const abcdName = new Array(answerLength).fill('').map((val, index) => `${String.fromCharCode(65 + index)}`).join('');
      const lastPersistedAbcdNumber = await QuizDAO.getLastPersistedAbcdQuizNumberByLength(answerLength);

      result.name = `${abcdName} ${(
        lastPersistedAbcdNumber + 1
      )}`;
      await QuizDAO.convertLegacyQuiz(result);

      return result;

    } catch (ex) {
      console.error('File IO Error', ex.message);
      throw new InternalServerError(`File IO Error: ${ex}`);
    }
  }

  @Post('/upload')
  public async uploadQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @UploadedFiles('uploadFiles[]') uploadedFiles: any, //
  ): Promise<IMessage> {

    const duplicateQuizzes = [];
    const savedQuizzes = [];
    const uploadedQuizzes = [];

    await asyncForEach(uploadedFiles, async file => {
      uploadedQuizzes.push({
        fileName: file.originalname,
        quiz: await QuizDAO.convertLegacyQuiz(JSON.parse(file.buffer.toString('UTF-8'))),
      });
    });

    await asyncForEach(uploadedQuizzes, async (data: { fileName: string, quiz: QuizModelItem }) => {
      let existingQuiz;
      if (data.quiz.name === null) {
        existingQuiz = true;
      } else {
        existingQuiz = await QuizDAO.getQuizByName(data.quiz.name);
      }
      if (existingQuiz) {
        duplicateQuizzes.push({
          quizName: data.quiz.name,
          fileName: data.fileName,
          renameRecommendation: await QuizDAO.getRenameRecommendations(data.quiz.name),
        });
      } else {
        data.quiz.privateKey = privateKey;
        data.quiz.visibility = QuizVisibility.Account;
        data.quiz.state = QuizState.Inactive;

        savedQuizzes.push((
          await QuizDAO.addQuiz(data.quiz)
        ).toJSON());
      }
    });

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UploadFile,
      payload: {
        duplicateQuizzes,
        quizData: savedQuizzes,
      },
    };
  }

  @Post('/next')
  public async startQuiz(
    @HeaderParam('authorization') token: string, //
    @BodyParam('quizName') quizName: string, //
  ): Promise<object> {
    const quiz = await QuizDAO.getQuizByName(quizName);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      };
    }

    if (quiz.privateKey !== token) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const existingQuiz = await QuizDAO.getQuizByName(quiz.name);
    let nextQuestionIndex;
    let currentStartTimestamp;

    if (quiz.sessionConfig.readingConfirmationEnabled && !quiz.readingConfirmationRequested) {
      nextQuestionIndex = await QuizDAO.nextQuestion(quiz);
      if (nextQuestionIndex === -1) {
        throw new BadRequestError(MessageProtocol.EndOfQuestions);
      }

      await QuizDAO.requestReadingConfirmation(quiz);

      await QuizDAO.updateQuiz(existingQuiz._id, {
        readingConfirmationRequested: true,
        state: QuizState.Running,
      });

      routeCache.removeCache(`${RoutingCache.QuizStatus}_${quiz.name}`);
      routeCache.removeCache(`${RoutingCache.QuizFullStatus}_${quiz.name}`);

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.ReadingConfirmationRequested,
      };
    }

    if (quiz.readingConfirmationRequested) {
      currentStartTimestamp = new Date().getTime();

      await QuizDAO.updateQuiz(existingQuiz._id, {
        currentStartTimestamp,
        readingConfirmationRequested: false,
        state: QuizState.Running,
      });

      quiz.readingConfirmationRequested = false;

      routeCache.removeCache(`${RoutingCache.QuizStatus}_${quiz.name}`);
      routeCache.removeCache(`${RoutingCache.QuizFullStatus}_${quiz.name}`);

      process.send({ message: IPCExchange.QuizStart, data: quiz.name });

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Start,
        payload: {
          currentStartTimestamp,
          currentQuestionIndex: quiz.currentQuestionIndex,
        },
      };
    }

    nextQuestionIndex = await QuizDAO.nextQuestion(quiz);
    if (nextQuestionIndex === -1) {
      throw new BadRequestError(MessageProtocol.EndOfQuestions);
    }
    currentStartTimestamp = new Date().getTime();

    await QuizDAO.updateQuiz(existingQuiz._id, {
      currentStartTimestamp,
      readingConfirmationRequested: false,
      state: QuizState.Running,
    });

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetInactive,
      payload: {
        quizName,
      },
    })));

    quiz.readingConfirmationRequested = false;
    quiz.currentStartTimestamp = currentStartTimestamp;

    routeCache.removeCache(`${RoutingCache.QuizStatus}_${quiz.name}`);
    routeCache.removeCache(`${RoutingCache.QuizFullStatus}_${quiz.name}`);

    process.send({ message: IPCExchange.QuizStart, data: quiz.name });

    AMQPConnector.sendRequestStatistics();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Start,
      payload: {
        currentStartTimestamp,
        nextQuestionIndex,
      },
    };
  }

  @Post('/stop')
  public async stopQuiz(@BodyParam('quizName') quizName: string, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return;
    }

    process.send({ message: IPCExchange.QuizStop, data: activeQuiz.name });
    await QuizDAO.stopQuiz(activeQuiz);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Stop,
      payload: {},
    };
  }

  @Get('/start-time')
  public async getStartTime(@HeaderParam('authorization') token: string): Promise<number> {
    const member = await MemberDAO.getMemberByToken(token);
    if (!member) {
      console.error('Unknown member');
      throw new BadRequestError('Unknown member');
    }

    const quiz = await QuizDAO.getQuizByName(member.currentQuizName);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      console.error('Quiz is not active and not running');
      throw new BadRequestError('Quiz is not active and not running');
    }

    return quiz.currentStartTimestamp;
  }

  @Get('/currentState/:quizName')
  @UseBefore(routeCache.cacheSeconds(10, req => `${RoutingCache.CurrentQuizState}_${req.params.quizName}`))
  public async getCurrentQuizState(@Param('quizName') quizName: string, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      };
    }
    const index = activeQuiz.currentQuestionIndex < 0 ? 0 : activeQuiz.currentQuestionIndex;
    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.CurrentState,
      payload: {
        questions: activeQuiz.questionList.slice(0, index + 1),
        questionIndex: index,
        startTimestamp: activeQuiz.currentStartTimestamp,
        numberOfQuestions: activeQuiz.questionList.length,
      },
    };
  }

  @Post('/reading-confirmation')
  public async showReadingConfirmation(@BodyParam('quizName') quizName: string, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.ReadingConfirmationRequested,
        payload: {},
      };
    }

    await QuizDAO.nextQuestion(activeQuiz);
    await QuizDAO.requestReadingConfirmation(activeQuiz);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.ReadingConfirmationRequested,
      payload: {},
    };
  }

  @Get('/startTime/:quizName')
  @UseBefore(routeCache.cacheSeconds(10, req => `${RoutingCache.QuizStartTime}_${req.params.quizName}`))
  public async getQuizStartTime(@Param('quizName') quizName: string, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.GetStartTime,
        payload: {},
      };
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetStartTime,
      payload: { startTimestamp: activeQuiz.currentStartTimestamp },
    };
  }

  @Get('/settings/:quizName')
  @UseBefore(routeCache.cacheSeconds(10, req => `${RoutingCache.QuizSettings}_${req.params.quizName}`))
  public async getQuizSettings(@Param('quizName') quizName: string, //
  ): Promise<IMessage> {

    const quiz = await QuizDAO.getQuizByName(quizName);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.UpdatedSettings,
        payload: {},
      };
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedSettings,
      payload: { settings: quiz.sessionConfig },
    };
  }

  @Post('/settings')
  public async updateQuizSettings(
    @HeaderParam('authorization') token: string, //
    @BodyParam('quizName') quizName: string, //
    @BodyParam('settings') quizSettings: { state: boolean, target: string }, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.UpdatedSettings,
        payload: {},
      };
    }
    if (activeQuiz.privateKey !== token) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    await QuizDAO.updateQuizSettings(activeQuiz, quizSettings);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedSettings,
      payload: {},
    };
  }

  @Put('/')
  public async addQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @BodyParam('quiz') quiz: IQuiz, //
    @BodyParam('serverPassword', { required: publicSettings.createQuizPasswordRequired }) serverPassword: string, //
  ): Promise<QuizModelItem> {
    if (!quiz) {
      throw new BadRequestError(MessageProtocol.InvalidParameters);
    }

    const existingQuiz = await QuizDAO.getQuizByName(quiz.name);
    if (existingQuiz && existingQuiz.privateKey !== privateKey) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const activeQuizzesAmount = await QuizDAO.getActiveQuizzes();
    if (activeQuizzesAmount.length >= publicSettings.limitActiveQuizzes) {
      throw new BadRequestError(MessageProtocol.TooMuchActiveQuizzes);
    }

    if (publicSettings.createQuizPasswordRequired) {
      if (!serverPassword) {
        throw new UnauthorizedError(MessageProtocol.ServerPasswordRequired);
      }
      if (serverPassword !== settings.createQuizPassword) {
        throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
      }
    }

    if (publicSettings.cacheQuizAssets) {
      const promises: Array<Promise<any>> = [];

      LoggerService.debug('[QuizRouter] Checking questionList for assets');
      quiz.questionList.forEach((question, index) => {
        promises.push(MatchTextToAssetsDb(question.questionText).then(val => question.questionText = val));
        LoggerService.debug('[QuizRouter] Checking answerOptionList of question ' + index + ' for assets');
        question.answerOptionList.forEach(answerOption => {
          promises.push(MatchTextToAssetsDb(answerOption.answerText).then(val => answerOption.answerText = val));
        });
      });

      LoggerService.debug('[QuizRouter] Awaiting ' + promises.length + ' resources');
      await Promise.all<any>(promises);
    }

    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    quiz.readingConfirmationRequested = false;
    quiz.privateKey = privateKey;
    quiz.state = quiz.state ?? quiz.questionList.length > 0 ? QuizState.Active : QuizState.Inactive;

    LoggerService.debug('[QuizRouter] Converting quiz ' + (
      quiz.name ?? quiz['hashtag']
    ) + ' from a legacy quiz');
    await QuizDAO.convertLegacyQuiz(quiz);

    LoggerService.debug('[QuizRouter] Publishing active quiz notification ' + quiz.name);
    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: quiz.state === QuizState.Active ? MessageProtocol.SetActive : MessageProtocol.SetInactive,
      payload: {
        quizName: quiz.name,
      },
    })));

    LoggerService.debug('[QuizRouter] Publishing request of statistics notification ' + quiz.name);
    AMQPConnector.sendRequestStatistics();

    let result: Document & QuizModelItem;
    if (existingQuiz) {
      LoggerService.debug('[QuizRouter] Quiz ' + quiz.name + ' already exists, updating the data');
      await QuizDAO.updateQuiz(existingQuiz.id, quiz);
      result = (
        await QuizDAO.getQuizByName(quiz.name)
      ).toJSON();
    } else {
      LoggerService.debug('[QuizRouter] Quiz ' + quiz.name + ' not already exists, so adding it to the db');
      result = (
        await QuizDAO.addQuiz(quiz)
      ).toJSON();
    }

    if (quiz.state === QuizState.Active) {
      LoggerService.debug('[QuizRouter] Quiz ' + quiz.name + ' is set to active, so initializing it');
      await QuizDAO.initQuiz(result);
    }

    LoggerService.debug('[QuizRouter] Quiz ' + quiz.name + ' is finished, returning data to the client');
    return result;
  }

  @Put('/save')
  public async saveQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @BodyParam('quiz') quiz: IQuiz, //
  ): Promise<IMessage> {
    if (quiz.name) {
      const existingQuiz = await QuizDAO.getQuizByName(quiz.name);
      if (existingQuiz) {
        if (existingQuiz.privateKey !== privateKey) {
          throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
        }

        await QuizDAO.updateQuiz(existingQuiz._id, quiz);
        return {
          status: StatusProtocol.Success,
          step: MessageProtocol.SaveQuiz,
          payload: (
            await QuizDAO.getQuizByName(quiz.name)
          ).toJSON(),
        };
      }
    }

    quiz.privateKey = privateKey;
    quiz.expiry = quiz.expiry ? new Date(quiz.expiry) : quiz.expiry;
    quiz.state = QuizState.Inactive;
    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    quiz.readingConfirmationRequested = false;

    quiz = await QuizDAO.convertLegacyQuiz(quiz);
    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.SaveQuiz,
      payload: (
        await QuizDAO.addQuiz(quiz)
      ).toJSON(),
    };
  }

  @Delete('/active/:quizName')
  public async deleteActiveQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): Promise<IMessage> {
    try {
      await QuizDAO.setQuizAsInactive(quizName, privateKey);

    } catch (e) {
      throw new BadRequestError(e.message);
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Closed,
      payload: {},
    };
  }

  @Delete('/:quizName')
  public async deleteQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): Promise<IMessage> {
    const existingQuiz = await QuizDAO.getQuizByName(quizName);
    if (existingQuiz) {
      if (existingQuiz.privateKey !== privateKey) {
        throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
      }
    }

    try {
      await QuizDAO.removeQuizByName(quizName);
      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Removed,
        payload: {},
      };
    } catch {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }
  }

  @Post('/reset/:quizName')
  public async resetQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): Promise<IMessage> {
    const quiz = await QuizDAO.getQuizByName(quizName);
    if (!quiz || quiz.privateKey !== privateKey) {
      return;
    }

    const doc = await QuizDAO.resetQuiz(quizName, privateKey);
    if (!doc) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Reset,
      payload: {},
    };
  }

  @Get('/export/:quizName/:privateKey/:theme/:language') //
  @UseBefore(routeCache.cacheSeconds(5, req => `${RoutingCache.QuizExportSheet}_${req.url}`))
  @ContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') //
  public async getExportFile(
    @Param('quizName') quizName: string, //
    @Param('privateKey') privateKey: string, //
    @Param('theme') themeName: string, //
    @Param('language') translation: string, //
    @Res() res: ICustomI18nResponse, //
  ): Promise<Buffer> {

    const quiz = await QuizDAO.getQuizForAttendee(quizName);
    if (!quiz || ![QuizState.Active, QuizState.Running, QuizState.Finished].includes(quiz.state)) {
      throw new BadRequestError('Quiz not found');
    }

    const parsedQuiz = await MatchAssetCachedQuiz(quiz.toJSON());

    res.locale = translation;

    const wb = new ExcelWorkbook({
      themeName,
      translation,
      quiz: parsedQuiz,
      mf: res.__mf,
    });
    await new Promise(resolve => wb.renderingFinished.on('done', () => resolve()));
    const buffer = await wb.writeToBuffer();
    res.header('Content-Length', buffer.length.toString());

    return buffer;
  }

  @Get('/member-group/:quizName')
  public async getFreeMemberGroup(@Param('quizName') quizName: string): Promise<IMessage> {
    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.GetFreeMemberGroup,
        payload: {},
      };
    }

    const groupName = await MemberDAO.getFreeMemberGroup(activeQuiz.name, [...activeQuiz.sessionConfig.nicks.memberGroups] as any);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetFreeMemberGroup,
      payload: {
        groupName,
      },
    };
  }

  @Get('/leaderboard/:quizName/:amount/:questionIndex?') //
  @UseBefore(routeCache.cacheSeconds(20, (req: Request) => {
    return `${req.url}_${req.headers.authorization}`;
  }))
  @OpenAPI({
    summary: 'Returns the leaderboard data',
    parameters: [
      {
        name: 'quizName',
        in: 'path',
        required: true,
      },
      {
        name: 'amount',
        in: 'path',
        required: true,
      },
      {
        name: 'questionIndex',
        in: 'path',
        required: false,
      },
    ],
  })
  public async getLeaderBoardData(
    @Param('quizName') quizName: string, //
    @Param('amount') amount: number, //
    @Param('questionIndex') questionIndex: number, //
    @HeaderParam('authorization') authorization: string, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.GetLeaderboardData,
        payload: {},
      };
    }
    const member = await MemberDAO.getMemberByToken(authorization);

    const correctResponses = await Leaderboard.getCorrectResponses(activeQuiz, questionIndex);
    const memberGroupResults = activeQuiz.sessionConfig.nicks.memberGroups.length ?
                               await Leaderboard.getRankingForGroup(activeQuiz, questionIndex) : null;

    const ownResponse: { [key: string]: any } = {};
    if (member) {
      ownResponse.element = correctResponses.find(value => value.name === member.name);
      ownResponse.index = correctResponses.indexOf(ownResponse.element);
      if (ownResponse.index > 0) {
        ownResponse.closestOpponent = correctResponses[ownResponse.index - 1];
      }
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetLeaderboardData,
      payload: {
        correctResponses: correctResponses.splice(0, amount),
        ownResponse,
        memberGroupResults: memberGroupResults,
      },
    };
  }

  @Post('/private')
  private async setQuizAsPrivate(@BodyParam('name') quizName: string, @HeaderParam('authorization') privateKey: string): Promise<void> {
    const existingQuiz = await QuizDAO.getQuizByName(quizName);
    if (!existingQuiz) {
      throw new NotFoundError(MessageProtocol.QuizNotFound);
    }
    if (existingQuiz.privateKey !== privateKey) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    await QuizDAO.updateQuiz(existingQuiz._id, { visibility: QuizVisibility.Account });
  }

  @Get('/public')
  private async getPublicQuizzes(@HeaderParam('authorization') privateKey: string): Promise<Array<QuizModelItem>> {
    return (
      await QuizDAO.getAllPublicQuizzes()
    ).filter(quiz => quiz.privateKey !== privateKey).map(quiz => quiz.toJSON());
  }

  @Post('/public/init')
  private async initQuizInstance(
    @BodyParam('name') quizName: string,
    @BodyParam('readingConfirmationEnabled', {required: false}) readingConfirmationEnabled: boolean,
    @BodyParam('confidenceSliderEnabled', {required: false}) confidenceSliderEnabled: boolean,
    @BodyParam('theme', {required: false}) theme: string,
    @HeaderParam('X-Access-Token') loginToken: string,
    @HeaderParam('authorization') privateKey: string,
  ): Promise<IMessage> {
    const user = await UserDAO.getUserByToken(loginToken);
    if (!user || !user.userAuthorizations.includes(UserRole.CreateQuiz)) {
      throw new UnauthorizedError('Unauthorized to create quiz');
    }

    const quiz = await QuizDAO.getPublicQuizByName(quizName);
    if (!quiz) {
      throw new NotFoundError('Quiz name not found');
    }

    quiz.origin = quizName;
    quiz.name = await QuizDAO.getRenameAsToken(quiz.name);
    quiz.privateKey = privateKey;
    quiz.visibility = QuizVisibility.Account;
    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    quiz.readingConfirmationRequested = false;

    quiz.sessionConfig.readingConfirmationEnabled = readingConfirmationEnabled ?? quiz.sessionConfig.readingConfirmationEnabled;
    quiz.sessionConfig.confidenceSliderEnabled = confidenceSliderEnabled ?? quiz.sessionConfig.confidenceSliderEnabled;
    quiz.sessionConfig.theme = theme ?? quiz.sessionConfig.theme;

    const doc = await QuizDAO.addQuiz(quiz.toJSON());
    await QuizDAO.initQuiz(doc);

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetActive,
      payload: {
        quizName: quiz.name,
      },
    })));

    AMQPConnector.sendRequestStatistics();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Init,
      payload: {
        quiz: doc.toJSON(),
      },
    };
  }

  @Get('/public/amount')
  private async getPublicQuizAmount(@HeaderParam('authorization') privateKey: string): Promise<number> {
    return (
      await this.getPublicQuizzes(privateKey)
    ).length;
  }

  @Get('/public/own')
  private async getOwnPublicQuizzes(@HeaderParam('authorization') privateKey: string): Promise<Array<QuizModelItem>> {
    return (
      await QuizDAO.getAllPublicQuizzes()
    ).filter(quiz => quiz.privateKey === privateKey).map(quiz => quiz.toJSON());
  }

  @Get('/public/amount/own')
  private async getOwnPublicQuizAmount(@HeaderParam('authorization') privateKey: string): Promise<number> {
    return (
      await this.getOwnPublicQuizzes(privateKey)
    ).length;
  }

  @Get('/active')
  @UseBefore(routeCache.cacheSeconds(10, RoutingCache.ActiveQuizzes))
  private getActiveQuizzes(): Promise<Array<string>> {
    return QuizDAO.getJoinableQuizzes().then(quizzes => quizzes.map(quiz => quiz.name));
  }

  @Get('/quiz/:quizName?') //
  @UseBefore(routeCache.cacheSeconds(10, req => `${RoutingCache.QuizData}_${req.params.quizName}`))
  @OpenAPI({
    summary: 'Returns the data of a quiz',
    parameters: [
      {
        name: 'quizName',
        in: 'path',
        required: false,
      },
    ],
  })
  private async getQuiz(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): Promise<IMessage> {

    const quizName = params.quizName;
    const member = await MemberDAO.getMemberByToken(token);

    if (!quizName && (
      !token || !member
    )) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz = await QuizDAO.getQuizForAttendee(quizName || member.currentQuizName);
    const payload: IQuizStatusPayload = {};

    if (quiz) {
      payload.state = quiz.state;
      payload.quiz = quiz.toJSON();
    }

    return {
      status: StatusProtocol.Success,
      step: quiz ? [QuizState.Active, QuizState.Running].includes(quiz.state) ? MessageProtocol.Available : quiz.privateKey === token
                                                                                                            ? MessageProtocol.Editable
                                                                                                            : MessageProtocol.AlreadyTaken
                 : MessageProtocol.Unavailable,
      payload,
    };
  }
}
