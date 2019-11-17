import { Response } from 'express';
import * as fs from 'fs';
import { DeleteWriteOpResultObject } from 'mongodb';
import * as path from 'path';
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
} from 'routing-controllers';
import AMQPConnector from '../../db/AMQPConnector';
import { default as DbDAO } from '../../db/DbDAO';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { AbstractAnswerEntity } from '../../entities/answer/AbstractAnswerEntity';
import { QuizEntity } from '../../entities/quiz/QuizEntity';
import { DbCollection } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { UserRole } from '../../enums/UserRole';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IMessage } from '../../interfaces/communication/IMessage';
import { IQuizStatusPayload } from '../../interfaces/IQuizStatusPayload';
import { IQuizEntity, IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { asyncForEach } from '../../lib/async-for-each';
import { MatchTextToAssetsDb } from '../../lib/cache/assets';
import { Leaderboard } from '../../lib/leaderboard/leaderboard';
import { QuizModel } from '../../models/quiz/QuizModelItem';
import { settings, staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/quiz')
export class QuizRouter extends AbstractRouter {
  private readonly _leaderboard: Leaderboard = new Leaderboard();

  @Get('/status/:quizName?')
  public getIsAvailableQuiz(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): IMessage {

    const quizName = params.quizName;
    const member = MemberDAO.getMemberByToken(token);

    if (!quizName && (!token || !member)) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz: IQuizEntity = QuizDAO.getQuizByName(quizName || member.currentQuizName);
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

  @Get('/full-status/:quizName?')
  public getFullQuizStatusData(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): object {
    const status = this.getIsAvailableQuiz(params, token);
    const quiz = this.getQuiz(params, token);
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

  @Get('/generate/demo/:languageId')
  public generateDemoQuiz(
    @Param('languageId') languageId: string, //
    @Res() res: Response, //
  ): object {

    try {
      const basePath = path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz');
      let demoQuizPath = path.join(basePath, `${languageId.toLowerCase()}.demo_quiz.json`);
      if (!fs.existsSync(demoQuizPath)) {
        demoQuizPath = path.join(basePath, 'en.demo_quiz.json');
      }
      const result: IQuizEntity = JSON.parse(fs.readFileSync(demoQuizPath).toString());
      result.name = 'Demo Quiz ' + (QuizDAO.getLastPersistedDemoQuizNumber() + 1);
      QuizDAO.convertLegacyQuiz(result);
      res.setHeader('Response-Type', 'application/json');
      return result;
    } catch (ex) {
      throw new InternalServerError(`File IO Error: ${ex}`);
    }
  }

  @Get('/generate/abcd/:languageId/:answerLength?')
  public generateAbcdQuiz(
    @Param('languageId') languageId: string, //
    @Param('answerLength') answerLength: number, //
    @Res() res: Response, //
  ): object {

    try {
      answerLength = answerLength || 4;
      const basePath = path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'abcd_quiz');
      let abcdQuizPath = path.join(basePath, `${languageId.toLowerCase()}.abcd_quiz.json`);
      if (!fs.existsSync(abcdQuizPath)) {
        abcdQuizPath = path.join(basePath, 'en.abcd_quiz.json');
      }
      const result: IQuizSerialized = JSON.parse(fs.readFileSync(abcdQuizPath).toString());
      let abcdName = '';
      for (let i = 0; i < answerLength; i++) {
        abcdName += String.fromCharCode(65 + i);
      }
      result.name = `${abcdName} ${(QuizDAO.getLastPersistedAbcdQuizNumberByLength(answerLength) + 1)}`;
      QuizDAO.convertLegacyQuiz(result);
      res.setHeader('Response-Type', 'application/json');
      return new QuizEntity(result).serialize();
    } catch (ex) {
      throw new InternalServerError(`File IO Error: ${ex}`);
    }
  }

  @Post('/upload')
  public async uploadQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @UploadedFiles('uploadFiles[]') uploadedFiles: any, //
  ): Promise<object> {

    const duplicateQuizzes = [];
    const quizData = [];

    uploadedFiles.forEach(file => {
      quizData.push({
        fileName: file.originalname,
        quiz: QuizDAO.convertLegacyQuiz(JSON.parse(file.buffer.toString('UTF-8'))),
      });
    });

    await asyncForEach(quizData, async (data: { fileName: string, quiz: IQuizEntity }) => {
      const existingQuiz = QuizDAO.getQuizByName(data.quiz.name);
      if (existingQuiz) {
        duplicateQuizzes.push({
          quizName: data.quiz.name,
          fileName: data.fileName,
          renameRecommendation: QuizDAO.getRenameRecommendations(data.quiz.name),
        });
      } else {
        data.quiz.privateKey = privateKey;
        data.quiz.visibility = QuizVisibility.Account;

        const quizValidator = new QuizModel(data.quiz);
        const result = quizValidator.validateSync();

        if (result) {
          throw result;
        }

        await quizValidator.save();
      }
    });

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UploadFile,
      payload: {
        duplicateQuizzes,
        quizData: quizData.filter(insertedQuiz => !duplicateQuizzes.find(duplicateQuiz => duplicateQuiz.fileName === insertedQuiz.fileName)),
      },
    };
  }

  @Post('/next')
  public async startQuiz(
    @HeaderParam('authorization') token: string, //
    @BodyParam('quizName') quizName: string, //
  ): Promise<object> {
    const quiz = QuizDAO.getQuizByName(quizName);
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

    if (quiz.sessionConfig.readingConfirmationEnabled && !quiz.readingConfirmationRequested) {
      const nextQuestionIndex = quiz.nextQuestion();
      if (nextQuestionIndex === -1) {
        throw new BadRequestError(MessageProtocol.EndOfQuestions);
      }

      quiz.requestReadingConfirmation();

      try {
        await DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quiz.name).id }, {
          readingConfirmationRequested: true,
          state: QuizState.Running,
        });
      } catch (e) {
        throw new InternalServerError(e);
      }

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.ReadingConfirmationRequested,
      };
    } else if (quiz.readingConfirmationRequested) {
      const currentStartTimestamp: number = new Date().getTime();

      try {
        await DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quiz.name).id }, {
          currentStartTimestamp,
          readingConfirmationRequested: false,
          state: QuizState.Running,
        });
      } catch (e) {
        throw new InternalServerError(e);
      }

      quiz.readingConfirmationRequested = false;
      quiz.startNextQuestion();
      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Start,
        payload: {
          currentStartTimestamp,
          currentQuestionIndex: quiz.currentQuestionIndex,
        },
      };
    } else {
      const nextQuestionIndex = quiz.nextQuestion();
      if (nextQuestionIndex === -1) {
        throw new BadRequestError(MessageProtocol.EndOfQuestions);
      }
      const currentStartTimestamp: number = new Date().getTime();

      try {
        await DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quiz.name).id }, {
          currentStartTimestamp,
          readingConfirmationRequested: false,
          state: QuizState.Running,
        });
      } catch (e) {
        throw new InternalServerError(e);
      }

      quiz.readingConfirmationRequested = false;
      quiz.currentStartTimestamp = currentStartTimestamp;
      quiz.startNextQuestion();

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Start,
        payload: {
          currentStartTimestamp,
          nextQuestionIndex,
        },
      };
    }
  }

  @Post('/stop')
  public stopQuiz(@BodyParam('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return;
    }

    DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quizName).id }, { currentStartTimestamp: -1 });

    activeQuiz.stop();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Stop,
      payload: {},
    };
  }

  @Get('/start-time')
  public getStartTime(@HeaderParam('authorization') token: string): number {
    const member = MemberDAO.getMemberByToken(token);
    if (!member) {
      console.error('Unknown member');
      throw new BadRequestError('Unknown member');
    }

    const quiz = QuizDAO.getQuizByName(member.currentQuizName);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      console.error('Quiz is not active and not running');
      throw new BadRequestError('Quiz is not active and not running');
    }

    return quiz.currentStartTimestamp;
  }

  @Get('/currentState/:quizName')
  public getCurrentQuizState(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
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
        questions: activeQuiz.questionList.slice(0, index + 1).map(question => question.serialize()),
        questionIndex: index,
        startTimestamp: activeQuiz.currentStartTimestamp,
        numberOfQuestions: activeQuiz.questionList.length,
      },
    };
  }

  @Post('/reading-confirmation')
  public showReadingConfirmation(@BodyParam('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.ReadingConfirmationRequested,
        payload: {},
      };
    }
    activeQuiz.nextQuestion();
    activeQuiz.requestReadingConfirmation();
    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.ReadingConfirmationRequested,
      payload: {},
    };
  }

  @Get('/startTime/:quizName')
  public getQuizStartTime(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
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
  public getQuizSettings(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getQuizByName(quizName);
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
      payload: { settings: activeQuiz.sessionConfig.serialize() },
    };
  }

  @Post('/settings')
  public updateQuizSettings(
    @HeaderParam('authorization') token: string, //
    @BodyParam('quizName') quizName: string, //
    @BodyParam('settings') quizSettings: { state: boolean, target: string }, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getQuizByName(quizName);
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

    DbDAO.updateOne(DbCollection.Quizzes, { _id: activeQuiz.id }, { ['sessionConfig.' + quizSettings.target]: quizSettings.state });

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedSettings,
      payload: {},
    };
  }

  @Put('/')
  public async addQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @BodyParam('quiz') quiz: IQuizSerialized, //
    @BodyParam('serverPassword', { required: settings.public.createQuizPasswordRequired }) serverPassword: string, //
  ): Promise<IQuizSerialized> {
    if (!quiz) {
      throw new BadRequestError(MessageProtocol.InvalidParameters);
    }
    const activeQuizzesAmount = QuizDAO.getActiveQuizzes();
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
        question.answerOptionList.forEach((answerOption: AbstractAnswerEntity) => {
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

    QuizDAO.convertLegacyQuiz(quiz);
    const quizValidator = new QuizModel(quiz);
    const result = quizValidator.validateSync();

    if (result) {
      throw result;
    }

    AMQPConnector.channel.publish('global', '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: quiz.state === QuizState.Active ? MessageProtocol.SetActive : MessageProtocol.SetInactive,
      payload: {
        quizName: quiz.name,
      },
    })));

    const existingQuiz = QuizDAO.getQuizByName(quiz.name);
    if (existingQuiz) {
      if (existingQuiz.privateKey !== privateKey) {
        throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
      }
      const newQuiz = Object.assign({}, existingQuiz.serialize(), quiz);
      await DbDAO.updateOne(DbCollection.Quizzes, { _id: existingQuiz.id }, newQuiz);
      return new QuizEntity(newQuiz).serialize();

    } else {
      const doc = await quizValidator.save();
      return new QuizEntity(doc).serialize();
    }
  }

  @Put('/save')
  public saveQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @BodyParam('quiz') quiz: IQuizSerialized, //
  ): void {
    const existingQuiz = QuizDAO.getQuizByName(quiz.name);
    if (existingQuiz) {
      if (existingQuiz.privateKey !== privateKey) {
        throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
      }
      QuizDAO.convertLegacyQuiz(quiz);

      DbDAO.updateOne(DbCollection.Quizzes, { _id: existingQuiz.id }, quiz);
      return;
    }

    quiz.privateKey = privateKey;
    quiz.expiry = quiz.expiry ? new Date(quiz.expiry) : quiz.expiry;
    quiz.state = QuizState.Inactive;

    QuizDAO.convertLegacyQuiz(quiz);
    const quizValidator = new QuizModel(quiz);
    const result = quizValidator.validateSync();

    if (result) {
      throw result;
    }

    quizValidator.save();
  }

  @Delete('/:quizName')
  public async deleteQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): Promise<object> {
    const quiz = QuizDAO.getQuizByName(quizName);
    if (!quiz || quiz.privateKey !== privateKey) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }
    const dbResult: DeleteWriteOpResultObject = await DbDAO.deleteOne(DbCollection.Quizzes, {
      name: quizName,
      privateKey: privateKey,
    });
    if (dbResult && dbResult.result.ok) {
      quiz.onRemove();
      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Removed,
        payload: {},
      };
    } else {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }
  }

  @Delete('/active/:quizName')
  public deleteActiveQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): object {

    if (!quizName || !privateKey) {
      throw new BadRequestError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.InvalidParameters,
        payload: {},
      }));
    }

    const quiz = QuizDAO.getQuizByName(quizName);
    if (!quiz || quiz.privateKey !== privateKey) {
      return;
    }

    quiz.setInactive();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Closed,
      payload: {},
    };
  }

  @Post('/reset/:quizName')
  public resetQuiz(
    @Param('quizName') quizName: string, //
    @HeaderParam('authorization') privateKey: string, //
  ): object {

    if (!quizName || !privateKey) {
      throw new BadRequestError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.InvalidParameters,
        payload: {},
      }));
    }

    const quiz = QuizDAO.getQuizByName(quizName);
    if (!quiz || quiz.privateKey !== privateKey) {
      return;
    }

    DbDAO.updateOne(DbCollection.Quizzes, { _id: quiz.id }, {
      state: QuizState.Active,
      currentQuestionIndex: -1,
      currentStartTimestamp: -1,
      readingConfirmationRequested: false,
    });

    const members = MemberDAO.getMembersOfQuiz(quizName);
    if (members.length > 0) {
      DbDAO.updateMany(DbCollection.Members, { currentQuizName: quizName }, {
        responses: members[0].generateResponseForQuiz(quiz.questionList.length),
      });
    }

    quiz.reset();

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

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return;
    }

    // TODO: The quiz contains the rewritten cached asset urls. Restore them to the original value!

    const wb = new ExcelWorkbook({
      themeName,
      translation,
      quiz: activeQuiz,
      mf: res.__mf,
    });
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
  public getFreeMemberGroup(@Param('quizName') quizName: string): object {
    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.GetFreeMemberGroup,
        payload: {},
      };
    }

    let groupName = 'Default';
    if (activeQuiz.sessionConfig.nicks.memberGroups.length > 1) {
      const memberGroupLoad = MemberDAO.getMemberAmountPerQuizGroup(activeQuiz.name, activeQuiz.sessionConfig.nicks.memberGroups);
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

  @Get('/leaderboard/:quizName/:amount/:questionIndex?')
  public getLeaderBoardData(
    @Param('quizName') quizName: string, //
    @Param('amount') amount: number, //
    @Param('questionIndex') questionIndex: number, //
    @HeaderParam('authorization') authorization: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.GetLeaderboardData,
        payload: {},
      };
    }
    const member = MemberDAO.getMemberByToken(authorization);

    const { correctResponses, memberGroupResults } = this._leaderboard.buildLeaderboard(activeQuiz, questionIndex);

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
  private setQuizAsPrivate(@BodyParam('name') quizName: string, @HeaderParam('authorization') privateKey: string): void {
    const existingQuiz = QuizDAO.getQuizByName(quizName);
    if (!existingQuiz) {
      throw new NotFoundError(MessageProtocol.QuizNotFound);
    }
    if (existingQuiz.privateKey !== privateKey) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    DbDAO.updateOne(DbCollection.Quizzes, { _id: existingQuiz.id }, { visibility: QuizVisibility.Account });
  }

  @Get('/public')
  private getPublicQuizzes(@HeaderParam('authorization') privateKey: string): Array<IQuizSerialized> {
    return QuizDAO.getAllPublicQuizzes().filter(quiz => quiz.privateKey !== privateKey).map(quiz => quiz.serialize());
  }

  @Post('/public/init')
  private async initQuizInstance(
    @BodyParam('name') quizName: string,
    @HeaderParam('X-Access-Token') loginToken: string,
    @HeaderParam('authorization') privateKey: string,
  ): Promise<IMessage> {
    const user = UserDAO.getUserByToken(loginToken);
    if (!user || !user.userAuthorizations.includes(UserRole.CreateQuiz)) {
      throw new UnauthorizedError('Unauthorized to create quiz');
    }

    const quiz = QuizDAO.getAllPublicQuizzes().find(q => q.name === quizName);
    if (!quiz) {
      throw new NotFoundError('Quiz name not found');
    }
    const serializedQuiz = quiz.serialize();

    delete quiz.id;
    serializedQuiz.name = QuizDAO.getRenameAsToken(serializedQuiz.name);
    serializedQuiz.privateKey = privateKey;
    serializedQuiz.state = QuizState.Active;
    serializedQuiz.visibility = QuizVisibility.Account;
    serializedQuiz.currentQuestionIndex = -1;
    serializedQuiz.currentStartTimestamp = -1;
    serializedQuiz.readingConfirmationRequested = false;

    const quizValidator = new QuizModel(serializedQuiz);
    const result = quizValidator.validateSync();
    if (result) {
      throw result;
    }
    await quizValidator.save();

    AMQPConnector.channel.publish('global', '.*', Buffer.from(JSON.stringify({
      status: StatusProtocol.Success,
      step: MessageProtocol.SetActive,
      payload: {
        quizName: serializedQuiz.name,
      },
    })));

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Init,
      payload: {
        quiz: serializedQuiz,
      },
    };
  }

  @Get('/public/amount')
  private getPublicQuizAmount(@HeaderParam('authorization') privateKey: string): number {
    return this.getPublicQuizzes(privateKey).length;
  }

  @Get('/public/own')
  private getOwnPublicQuizzes(@HeaderParam('authorization') privateKey: string): Array<IQuizSerialized> {
    return QuizDAO.getAllPublicQuizzes().filter(quiz => quiz.privateKey === privateKey).map(quiz => quiz.serialize());
  }

  @Get('/public/amount/own')
  private getOwnPublicQuizAmount(@HeaderParam('authorization') privateKey: string): number {
    return this.getOwnPublicQuizzes(privateKey).length;
  }

  @Get('/')
  private getAll(): object {
    return {};
  }

  @Get('/quiz/:quizName?')
  private getQuiz(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): IMessage {

    const quizName = params.quizName;
    const member = MemberDAO.getMemberByToken(token);

    if (!quizName && (!token || !member)) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz: IQuizEntity = QuizDAO.getQuizByName(quizName || member.currentQuizName);
    const payload: IQuizStatusPayload = {};

    if (quiz) {
      payload.state = quiz.state;
      payload.quiz = quiz.serialize();
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
