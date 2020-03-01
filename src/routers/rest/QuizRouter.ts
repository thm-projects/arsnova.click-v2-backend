import { Response } from 'express';
import * as fs from 'fs';
import { Document } from 'mongoose';
import * as path from 'path';
import {
  BadRequestError,
  BodyParam,
  ContentType,
  Delete,
  Get,
  HeaderParam,
  InternalServerError, JsonController, NotFoundError, Param, Params, Post, Put, Res, UnauthorizedError, UploadedFiles,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import AMQPConnector from '../../db/AMQPConnector';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { UserRole } from '../../enums/UserRole';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IMessage } from '../../interfaces/communication/IMessage';
import { IQuizStatusPayload } from '../../interfaces/IQuizStatusPayload';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';
import { asyncForEach } from '../../lib/async-for-each';
import { MatchAssetCachedQuiz, MatchTextToAssetsDb } from '../../lib/cache/assets';
import { Leaderboard } from '../../lib/leaderboard/leaderboard';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import { settings, staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/quiz')
export class QuizRouter extends AbstractRouter {
  private readonly _leaderboard: Leaderboard = new Leaderboard();

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

  @Get('/full-status/:quizName?') @OpenAPI({
    summary: 'Returns the quiz state and content',
    parameters: [
      {
        name: 'quizName',
        in: 'path',
        required: false,
      },
    ],
  })
  public async getFullQuizStatusData(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): Promise<object> {
    const status = await this.getIsAvailableQuiz(params, token);
    const quiz = await this.getQuiz(params, token);
    return {
      status: status.status === StatusProtocol.Success && quiz.status === StatusProtocol.Success ? StatusProtocol.Success : StatusProtocol.Failed,
      step: status.step === MessageProtocol.Available && quiz.step === MessageProtocol.Available ? MessageProtocol.Available
                                                                                                 : MessageProtocol.Unavailable,
      payload: {
        status: status.payload,
        quiz: quiz.payload,
      },
    };
  }

  @Get('/generate/demo/:languageId') //
  @ContentType('application/json')
  public async generateDemoQuiz(
    @Param('languageId') languageId: string, //
    @Res() res: Response, //
  ): Promise<IQuiz> {

    try {
      const basePath = path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz');
      let demoQuizPath = path.join(basePath, `${languageId.toLowerCase()}.demo_quiz.json`);
      if (!fs.existsSync(demoQuizPath)) {
        demoQuizPath = path.join(basePath, 'en.demo_quiz.json');
      }

      const result: IQuiz = JSON.parse(fs.readFileSync(demoQuizPath).toString());
      const lastPersistedDemoQuizNumber = await QuizDAO.getLastPersistedDemoQuizNumber();
      result.name = 'Demo Quiz ' + (
                    lastPersistedDemoQuizNumber + 1
      );
      QuizDAO.convertLegacyQuiz(result);

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
      const basePath = path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'abcd_quiz');
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
      QuizDAO.convertLegacyQuiz(result);

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
      const existingQuiz = await QuizDAO.getQuizByName(data.quiz.name);
      if (existingQuiz) {
        duplicateQuizzes.push({
          quizName: data.quiz.name,
          fileName: data.fileName,
          renameRecommendation: await QuizDAO.getRenameRecommendations(data.quiz.name),
        });
      } else {
        data.quiz.privateKey = privateKey;
        data.quiz.visibility = QuizVisibility.Account;

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

      await QuizDAO.startNextQuestion(quiz);

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

    quiz.readingConfirmationRequested = false;
    quiz.currentStartTimestamp = currentStartTimestamp;

    await QuizDAO.startNextQuestion(quiz);

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
  public async getQuizSettings(@Param('quizName') quizName: string, //
  ): Promise<IMessage> {

    const activeQuiz = await QuizDAO.getQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.UpdatedSettings,
        payload: {},
      };
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedSettings,
      payload: { settings: activeQuiz.sessionConfig },
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
    @BodyParam('serverPassword', { required: settings.public.createQuizPasswordRequired }) serverPassword: string, //
  ): Promise<QuizModelItem> {
    if (!quiz) {
      throw new BadRequestError(MessageProtocol.InvalidParameters);
    }

    const existingQuiz = await QuizDAO.getQuizByName(quiz.name);
    if (existingQuiz && existingQuiz.privateKey !== privateKey) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const activeQuizzesAmount = await QuizDAO.getActiveQuizzes();
    if (activeQuizzesAmount.length >= settings.public.limitActiveQuizzes) {
      throw new BadRequestError(MessageProtocol.TooMuchActiveQuizzes);
    }

    if (settings.public.createQuizPasswordRequired) {
      if (!serverPassword) {
        throw new UnauthorizedError(MessageProtocol.ServerPasswordRequired);
      }
      if (serverPassword !== settings.createQuizPassword) {
        throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
      }
    }

    if (settings.public.cacheQuizAssets) {
      const promises: Array<Promise<any>> = [];

      quiz.questionList.forEach(question => {
        promises.push(MatchTextToAssetsDb(question.questionText).then(val => question.questionText = val));
        question.answerOptionList.forEach(answerOption => {
          promises.push(MatchTextToAssetsDb(answerOption.answerText).then(val => answerOption.answerText = val));
        });
      });

      await Promise.all<any>(promises);
    }

    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    quiz.readingConfirmationRequested = false;
    quiz.privateKey = privateKey;
    quiz.state = quiz.questionList.length > 0 ? QuizState.Active : QuizState.Inactive;

    await QuizDAO.convertLegacyQuiz(quiz);

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: quiz.state === QuizState.Active ? MessageProtocol.SetActive : MessageProtocol.SetInactive,
      payload: {
        quizName: quiz.name,
      },
    })));

    let result: Document & QuizModelItem;
    if (existingQuiz) {
      await QuizDAO.updateQuiz(existingQuiz.id, quiz);
      result = (
        await QuizDAO.getQuizByName(quiz.name)
      ).toJSON();
    } else {
      result = (
        await QuizDAO.addQuiz(quiz)
      ).toJSON();
    }

    if (quiz.state === QuizState.Active) {
      await QuizDAO.initQuiz(result);
    }
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
            await QuizDAO.addQuiz(quiz)
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

  @Delete('/:quizName')
  public async deleteQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): Promise<IMessage> {
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
  @ContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') //
  public async getExportFile(
    @Param('quizName') quizName: string, //
    @Param('privateKey') privateKey: string, //
    @Param('theme') themeName: string, //
    @Param('language') translation: string, //
    @Res() res: ICustomI18nResponse, //
  ): Promise<Buffer> {

    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return;
    }

    const parsedQuiz = await MatchAssetCachedQuiz(activeQuiz.toJSON());

    const wb = new ExcelWorkbook({
      themeName,
      translation,
      quiz: parsedQuiz,
      mf: res.__mf,
    });
    await new Promise(resolve => wb.renderingFinished.on('done', () => resolve()));

    const date: Date = new Date();
    const dateFormatted = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}-${date.getHours()}_${date.getMinutes()}`;
    const name = `Export-${quizName}-${dateFormatted}.xlsx`;
    const buffer = await wb.writeToBuffer();

    res.header('Content-Disposition',
      'attachment; filename="' + encodeURIComponent(name) + '"; filename*=utf-8\'\'' + encodeURIComponent(name) + ';');
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

    let groupName = 'Default';
    if (activeQuiz.sessionConfig.nicks.memberGroups.length > 1) {
      const memberGroupLoad = await MemberDAO.getMemberAmountPerQuizGroup(activeQuiz.name, activeQuiz.sessionConfig.nicks.memberGroups);
      if (memberGroupLoad) {
        groupName = Object.entries(memberGroupLoad).sort((a, b) => a[1] - b[1])[0][0];
      }
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetFreeMemberGroup,
      payload: {
        groupName,
      },
    };
  }

  @Get('/leaderboard/:quizName/:amount/:questionIndex?') //
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

    const { correctResponses, memberGroupResults } = await this._leaderboard.buildLeaderboard(activeQuiz, questionIndex);

    const sortedCorrectResponses = this._leaderboard.sortBy(correctResponses, 'score');
    const ownResponse: { [key: string]: any } = {};
    if (member) {
      ownResponse.element = sortedCorrectResponses.find(value => value.name === member.name);
      ownResponse.index = sortedCorrectResponses.indexOf(ownResponse.element);
      if (ownResponse.index > 0) {
        ownResponse.closestOpponent = sortedCorrectResponses[ownResponse.index - 1];
      }
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetLeaderboardData,
      payload: {
        correctResponses: sortedCorrectResponses.splice(0, amount),
        ownResponse,
        memberGroupResults: this._leaderboard.sortBy(memberGroupResults, 'score'),
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

    quiz.name = await QuizDAO.getRenameAsToken(quiz.name);
    quiz.privateKey = privateKey;
    quiz.visibility = QuizVisibility.Account;
    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    quiz.readingConfirmationRequested = false;

    const doc = await QuizDAO.addQuiz(quiz.toJSON());
    await QuizDAO.initQuiz(doc);

    AMQPConnector.channel.publish(AMQPConnector.globalExchange, '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetActive,
      payload: {
        quizName: quiz.name,
      },
    })));

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

  @Get('/')
  private getAll(): object {
    return {};
  }

  @Get('/quiz/:quizName?') //
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

    const quiz = await QuizDAO.getQuizByName(quizName || member.currentQuizName);
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
