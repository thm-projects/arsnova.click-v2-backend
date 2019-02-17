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
import { default as DbDAO } from '../../db/DbDAO';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { AbstractAnswerEntity } from '../../entities/answer/AbstractAnswerEntity';
import { QuizEntity } from '../../entities/quiz/QuizEntity';
import { DbCollection } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { TokenType } from '../../enums/TokenType';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IQuizStatusPayload } from '../../interfaces/IQuizStatusPayload';
import { IQuizEntity, IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { MatchTextToAssetsDb } from '../../lib/cache/assets';
import { Leaderboard } from '../../lib/leaderboard/leaderboard';
import { QuizModel } from '../../models/quiz/QuizModelItem';
import { AuthService } from '../../services/AuthService';
import { settings, staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/quiz')
export class QuizRouter extends AbstractRouter {
  private readonly _leaderboard: Leaderboard = new Leaderboard();

  @Get('/status/:quizName?')
  public getIsAvailableQuiz(
    @Params() params: { [key: string]: any }, //
    @HeaderParam('authorization', { required: false }) token: string, //
  ): object {

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
        payload.memberGroups = quiz.memberGroups.map(memberGroup => memberGroup.serialize());
        payload.startTimestamp = quiz.currentStartTimestamp;
        payload.readingConfirmationRequested = quiz.readingConfirmationRequested;
      }

      payload.name = quiz.name;
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
  public uploadQuiz(
    @HeaderParam('authorization') privateKey: string, //
    @UploadedFiles('uploadFiles[]') uploadedFiles: any, //
  ): object {

    const duplicateQuizzes = [];
    const quizData = [];

    uploadedFiles.forEach(file => {
      quizData.push({
        fileName: file.originalname,
        quiz: JSON.parse(file.buffer.toString('UTF-8')),
      });
    });

    quizData.forEach((data: { fileName: string, quiz: IQuizEntity }) => {
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

        quizValidator.save();
      }
    });

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UploadFile,
      payload: { duplicateQuizzes },
    };
  }

  @Post('/next')
  public startQuiz(@HeaderParam('authorization') token: string, //
  ): object {
    const quiz = QuizDAO.getQuizByToken(token);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      throw new InternalServerError(MessageProtocol.IsInactive);
    }

    if (quiz.sessionConfig.readingConfirmationEnabled && !quiz.readingConfirmationRequested) {
      const nextQuestionIndex = quiz.nextQuestion();
      if (nextQuestionIndex === -1) {
        throw new BadRequestError(MessageProtocol.EndOfQuestions);
      }

      quiz.requestReadingConfirmation();
      DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quiz.name).id }, {
        readingConfirmationRequested: true,
        state: QuizState.Running,
      });
      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.ReadingConfirmationRequested,
      };
    } else if (quiz.readingConfirmationRequested) {
      const currentStartTimestamp: number = new Date().getTime();
      DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quiz.name).id }, {
        currentStartTimestamp,
        readingConfirmationRequested: false,
        state: QuizState.Running,
      });

      quiz.readingConfirmationRequested = false;
      quiz.startNextQuestion(currentStartTimestamp);
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
      DbDAO.updateOne(DbCollection.Quizzes, { _id: QuizDAO.getQuizByName(quiz.name).id }, {
        currentStartTimestamp,
        readingConfirmationRequested: false,
        state: QuizState.Running,
      });

      quiz.readingConfirmationRequested = false;
      quiz.currentStartTimestamp = currentStartTimestamp;
      quiz.startNextQuestion(currentStartTimestamp);
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
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
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
      throw new BadRequestError('Unknown member');
    }

    const quiz = QuizDAO.getQuizByName(member.currentQuizName);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      throw new BadRequestError('Quiz is not active and not running');
    }

    return quiz.currentStartTimestamp;
  }

  public postNextStep(@HeaderParam('authorization') token: string): object {
    const quiz = QuizDAO.getQuizByToken(token);
    if (!quiz || ![QuizState.Active, QuizState.Running].includes(quiz.state)) {
      return;
    }

    if (quiz.sessionConfig.readingConfirmationEnabled) {
      return this.showReadingConfirmation(quiz.name);
    }

    if (quiz.currentQuestionIndex < quiz.questionList.length) {
      this.startQuiz(quiz.name);
    }
  }

  @Get('/currentState/:quizName')
  public getCurrentQuizState(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
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
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
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
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
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
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.Unavailable,
        payload: {},
      }));
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
    @BodyParam('settings') quizSettings: { state: boolean, target: string }, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getQuizByToken(token);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
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
      throw new InternalServerError(MessageProtocol.TooMuchActiveQuizzes);
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

    quiz.adminToken = AuthService.createToken({
      quizName: quiz.name,
      privateKey: privateKey,
      type: TokenType.QuizToken,
    });
    quiz.currentQuestionIndex = -1;
    quiz.currentStartTimestamp = -1;
    quiz.privateKey = privateKey;
    quiz.state = QuizState.Active;

    QuizDAO.convertLegacyQuiz(quiz);
    const quizValidator = new QuizModel(quiz);
    const result = quizValidator.validateSync();

    if (result) {
      throw result;
    }

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
    quiz.expiry = new Date(quiz.expiry);
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
    if (dbResult && dbResult.deletedCount) {
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

    DbDAO.updateOne(DbCollection.Quizzes, { _id: quiz.id }, { state: QuizState.Inactive });
    DbDAO.deleteMany(DbCollection.Members, { currentQuizName: quiz.name });

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
    if (!quiz || quiz.adminToken !== privateKey) {
      return;
    }

    DbDAO.updateOne(DbCollection.Quizzes, { _id: quiz.id }, {
      state: QuizState.Active,
      currentQuestionIndex: -1,
      currentStartTimestamp: -1,
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
    @Res() res: I18nResponse, //
  ): Promise<Buffer> {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);

    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
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

  @Get('/leaderboard/:quizName/:questionIndex?')
  public getLeaderBoardData(
    @Param('quizName') quizName: string, //
    @Param('questionIndex') questionIndex: number, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
    }

    const { correctResponses, partiallyCorrectResponses, memberGroupResults } = this._leaderboard.buildLeaderboard(activeQuiz, questionIndex);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetLeaderboardData,
      payload: {
        correctResponses: this._leaderboard.sortBy(correctResponses, 'score'),
        partiallyCorrectResponses: this._leaderboard.sortBy(partiallyCorrectResponses, 'score'),
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
}
