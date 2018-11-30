import { IAnswerOption } from 'arsnova-click-v2-types/dist/answeroptions/interfaces';
import { IActiveQuiz } from 'arsnova-click-v2-types/dist/common';
import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import { IIsAvailableQuizPayload, IQuestion, IQuestionGroup } from 'arsnova-click-v2-types/dist/questions/interfaces';
import { ISessionConfiguration } from 'arsnova-click-v2-types/dist/session_configuration/interfaces';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestError, BodyParam, Delete, Get, InternalServerError, JsonController, NotFoundError, Param, Patch, Post, Req, Res, UnauthorizedError,
} from 'routing-controllers';
import { MatchTextToAssetsDb } from '../../cache/assets';
import { default as DbDAO } from '../../db/DbDAO';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { DATABASE_TYPE } from '../../Enums';
import { ExcelWorkbook } from '../../export/excel-workbook';
import { Leaderboard } from '../../leaderboard/leaderboard';
import { settings, staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/quiz')
export class QuizRouter extends AbstractRouter {
  private readonly _leaderboard: Leaderboard = new Leaderboard();

  @Get('/status/:quizName')
  public getIsAvailableQuiz(@Param('quizName') quizName: string, //
  ): object {

    const quiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    const payload: IIsAvailableQuizPayload = {};

    const isInactive: boolean = QuizManagerDAO.isInactiveQuiz(quizName);
    let isInProgress = false;

    if (quiz) {
      if (quiz.currentQuestionIndex === -1) {
        const sessionConfig: ISessionConfiguration = QuizManagerDAO.getActiveQuizByName(quizName).originalObject.sessionConfig;
        const provideNickSelection: boolean = sessionConfig.nicks.selectedNicks.length > 0;

        payload.available = true;
        payload.provideNickSelection = provideNickSelection;
        payload.authorizeViaCas = sessionConfig.nicks.restrictToCasLogin;
        payload.maxMembersPerGroup = sessionConfig.nicks.maxMembersPerGroup;
        payload.autoJoinToGroup = sessionConfig.nicks.autoJoinToGroup;
        payload.memberGroups = quiz.memberGroups.map(memberGroup => memberGroup.serialize());
      } else {
        isInProgress = true;
      }
    }

    const step = quiz && !isInProgress ? COMMUNICATION_PROTOCOL.QUIZ.AVAILABLE : isInactive || isInProgress ? COMMUNICATION_PROTOCOL.QUIZ.EXISTS
                                                                                                            : COMMUNICATION_PROTOCOL.QUIZ.UNDEFINED;

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step,
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
      const result: IQuestionGroup = JSON.parse(fs.readFileSync(demoQuizPath).toString());
      result.hashtag = 'Demo Quiz ' + (
                       QuizManagerDAO.getLastPersistedDemoQuizNumber() + 1
      );
      QuizManagerDAO.convertLegacyQuiz(result);
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
      const result: IQuestionGroup = JSON.parse(fs.readFileSync(abcdQuizPath).toString());
      let abcdName = '';
      for (let i = 0; i < answerLength; i++) {
        abcdName += String.fromCharCode(65 + i);
      }
      result.hashtag = `${abcdName} ${(
        QuizManagerDAO.getLastPersistedAbcdQuizNumberByLength(answerLength) + 1
      )}`;
      QuizManagerDAO.convertLegacyQuiz(result);
      res.setHeader('Response-Type', 'application/json');
      return result;
    } catch (ex) {
      throw new InternalServerError(`File IO Error: ${ex}`);
    }
  }

  @Post('/upload')
  public uploadQuiz(
    @Param('languageId') languageId: string, //
    @Param('answerLength') answerLength: number, //
    @Req() req: IUploadRequest, //
  ): object {

    const duplicateQuizzes = [];
    const quizData = [];
    let privateKey = '';
    if (req.busboy) {
      return new Promise(resolveRequest => {
        const promise = new Promise((resolve) => {

          // fieldname, file, filename, encoding, mimetype
          req.busboy.on('file', (fieldname, file, filename) => {
            if (fieldname === 'uploadFiles[]') {
              let quiz = '';
              file.on('data', (buffer: Buffer) => {
                quiz += buffer.toString('utf8');
              });
              file.on('end', () => {
                quizData.push({
                  fileName: filename,
                  quiz: JSON.parse(quiz),
                });
              });
            }
          });

          req.busboy.on('field', (key, value) => {
            if (key === 'privateKey') {
              privateKey = value;
            }
          });

          req.busboy.on('finish', () => {
            resolve();
          });

          req.pipe(req.busboy);
        });
        promise.then(() => {
          quizData.forEach((data: { fileName: string, quiz: IQuestionGroup }) => {
            const dbResult = DbDAO.read(DATABASE_TYPE.QUIZ, { quizName: data.quiz.hashtag });
            if (dbResult) {
              duplicateQuizzes.push({
                quizName: data.quiz.hashtag,
                fileName: data.fileName,
                renameRecommendation: QuizManagerDAO.getRenameRecommendations(data.quiz.hashtag),
              });
            } else {
              DbDAO.create(DATABASE_TYPE.QUIZ, {
                quizName: data.quiz.hashtag,
                privateKey,
              });
              QuizManagerDAO.initInactiveQuiz(data.quiz.hashtag);
              if (settings.public.cacheQuizAssets) {
                const quiz: IQuestionGroup = data.quiz;
                quiz.questionList.forEach((question: IQuestion) => {
                  MatchTextToAssetsDb(question.questionText);
                  question.answerOptionList.forEach((answerOption: IAnswerOption) => {
                    MatchTextToAssetsDb(answerOption.answerText);
                  });
                });
              }
            }
          });
          resolveRequest({
            status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
            step: COMMUNICATION_PROTOCOL.QUIZ.UPLOAD_FILE,
            payload: { duplicateQuizzes },
          });
        });
      });
    } else {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.UPLOAD_FILE,
        payload: { message: 'busboy not found' },
      }));
    }
  }

  @Post('/start')
  public startQuiz(
    @BodyParam('quizName') quizName: string, //
    @Param('answerLength') answerLength: number, //
    @Req() req: IUploadRequest, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    if (activeQuiz.currentStartTimestamp) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.ALREADY_STARTED,
        payload: {
          startTimestamp: activeQuiz.currentStartTimestamp,
          nextQuestionIndex: activeQuiz.currentQuestionIndex,
        },
      }));
    } else {
      const nextQuestionIndex = activeQuiz.originalObject.sessionConfig.readingConfirmationEnabled ? activeQuiz.currentQuestionIndex
                                                                                                   : activeQuiz.nextQuestion();

      if (nextQuestionIndex === -1) {
        return {
          status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
          step: COMMUNICATION_PROTOCOL.QUIZ.END_OF_QUESTIONS,
          payload: {},
        };
      } else {
        const startTimestamp: number = new Date().getTime();
        activeQuiz.setTimestamp(startTimestamp);
        return {
          status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
          step: COMMUNICATION_PROTOCOL.QUIZ.START,
          payload: {
            startTimestamp,
            nextQuestionIndex,
          },
        };
      }
    }
  }

  @Post('/stop')
  public stopQuiz(@BodyParam('quizName') quizName: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    activeQuiz.stop();
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.STOP,
      payload: {},
    };
  }

  @Get('/currentState/:quizName')
  public getCurrentQuizState(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    const index = activeQuiz.currentQuestionIndex < 0 ? 0 : activeQuiz.currentQuestionIndex;
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.CURRENT_STATE,
      payload: {
        questions: activeQuiz.originalObject.questionList.slice(0, index + 1),
        questionIndex: index,
        startTimestamp: activeQuiz.currentStartTimestamp,
        numberOfQuestions: activeQuiz.originalObject.questionList.length,
      },
    };
  }

  @Post('/reading-confirmation')
  public showReadingConfirmation(@BodyParam('quizName') quizName: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    activeQuiz.nextQuestion();
    activeQuiz.requestReadingConfirmation();
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.READING_CONFIRMATION_REQUESTED,
      payload: {},
    };
  }

  @Get('/startTime/:quizName')
  public getQuizStartTime(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.GET_STARTTIME,
      payload: { startTimestamp: activeQuiz.currentStartTimestamp },
    };
  }

  @Get('/settings/:quizName')
  public getQuizSettings(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.UPDATED_SETTINGS,
      payload: { settings: activeQuiz.originalObject.sessionConfig },
    };
  }

  @Post('/settings/update')
  public updateQuizSettings(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('target') target: string, //
    @BodyParam('state') state: boolean, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    activeQuiz.updateQuizSettings(target, state);
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.UPDATED_SETTINGS,
      payload: {},
    };
  }

  @Post('/reserve')
  public reserveQuiz(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('privateKey') privateKey: string, //
    @BodyParam('serverPassword') serverPassword: string, //
  ): object {

    if (!quizName || !privateKey) {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
    }
    const activeQuizzesAmount = QuizManagerDAO.getAllActiveQuizNames();
    if (activeQuizzesAmount.length >= settings.public.limitActiveQuizzes) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.TOO_MUCH_ACTIVE_QUIZZES,
        payload: {
          activeQuizzes: activeQuizzesAmount,
          limitActiveQuizzes: settings.public.limitActiveQuizzes,
        },
      }));
    }
    if (settings.public.createQuizPasswordRequired) {
      if (!serverPassword) {
        return {
          status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
          step: COMMUNICATION_PROTOCOL.QUIZ.SERVER_PASSWORD_REQUIRED,
          payload: {},
        };
      }
      if (serverPassword !== settings.createQuizPassword) {
        throw new UnauthorizedError(JSON.stringify({
          status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
          step: COMMUNICATION_PROTOCOL.AUTHORIZATION.INSUFFICIENT_PERMISSIONS,
          payload: {},
        }));
      }
    }
    QuizManagerDAO.initInactiveQuiz(quizName);
    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: quizName,
      privateKey: privateKey,
    });
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.RESERVED,
      payload: {},
    };
  }

  @Post('/reserve/override')
  public reserveQuizWithOverride(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('privateKey') privateKey: string, //
  ): object {

    if (!quizName || !privateKey) {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
    }
    QuizManagerDAO.initInactiveQuiz(quizName);
    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: quizName,
      privateKey: privateKey,
    });
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.RESERVED,
      payload: {},
    };
  }

  @Delete('/')
  public deleteQuiz(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('privateKey') privateKey: string, //
  ): object {

    if (!quizName || !privateKey) {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
    }
    const dbResult: boolean = DbDAO.delete(DATABASE_TYPE.QUIZ, {
      quizName: quizName,
      privateKey: privateKey,
    });
    if (dbResult) {
      QuizManagerDAO.removeQuiz(quizName);
      return {
        status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
        step: COMMUNICATION_PROTOCOL.QUIZ.REMOVED,
        payload: {},
      };
    } else {
      throw new UnauthorizedError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.INSUFFICIENT_PERMISSIONS,
        payload: {},
      }));
    }
  }

  @Delete('/active')
  public deleteActiveQuiz(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('privateKey') privateKey: string, //
  ): object {

    if (!quizName || !privateKey) {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
    }
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    const dbResult: Object = DbDAO.read(DATABASE_TYPE.QUIZ, {
      quizName,
      privateKey,
    });

    if (!dbResult) {
      throw new UnauthorizedError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.INSUFFICIENT_PERMISSIONS,
        payload: {},
      }));
    }

    if (activeQuiz) {
      activeQuiz.onDestroy();
      QuizManagerDAO.setQuizAsInactive(quizName);
      return {
        status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
        step: COMMUNICATION_PROTOCOL.LOBBY.CLOSED,
        payload: {},
      };
    }
  }

  @Patch('/reset/:quizName')
  public resetQuiz(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    activeQuiz.reset();
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.RESET,
      payload: {},
    };
  }

  @Get('/export/:quizName/:privateKey/:theme/:language')
  public getExportFile(
    @Param('quizName') quizName: string, //
    @Param('privateKey') privateKey: string, //
    @Param('theme') themeName: string, //
    @Param('language') translation: string, //
    @Res() res: I18nResponse, //
  ): void {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    const dbResult: Object = DbDAO.read(DATABASE_TYPE.QUIZ, {
      quizName,
      privateKey,
    });

    if (!dbResult) {
      throw new NotFoundError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.EXPORT.QUIZ_NOT_FOUND,
        payload: {},
      }));
    }
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
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
    wb.write(`Export-${quizName}-${dateFormatted}.xlsx`, res);
  }

  @Get('/leaderboard/:quizName/:questionIndex?')
  public getLeaderBoardData(
    @Param('quizName') quizName: string, //
    @Param('questionIndex') questionIndex: number, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }

    const questionAmount: number = activeQuiz.originalObject.questionList.length;
    const endIndex: number = isNaN(questionIndex) || questionIndex < 0 || questionIndex > questionAmount ? questionAmount : questionIndex + 1;
    const correctResponses: any = {};
    const partiallyCorrectResponses: any = {};

    const orderByGroups = activeQuiz.memberGroups.length > 1;
    const memberGroupResults = {};

    activeQuiz.memberGroups.forEach((memberGroup) => {
      memberGroupResults[memberGroup.name] = {
        correctQuestions: [],
        responseTime: 0,
        score: 0,
        memberAmount: memberGroup.members.length,
      };

      memberGroup.members.forEach(attendee => {
        for (let i: number = questionIndex; i < endIndex; i++) {
          const question: IQuestion = activeQuiz.originalObject.questionList[i];
          if (['SurveyQuestion', 'ABCDSingleChoiceQuestion'].indexOf(question.TYPE) > -1) {
            continue;
          }
          const isCorrect = this._leaderboard.isCorrectResponse(attendee.responses[i], question);
          if (isCorrect === 1) {
            if (!correctResponses[attendee.name]) {
              correctResponses[attendee.name] = {
                responseTime: 0,
                correctQuestions: [],
                confidenceValue: 0,
              };
            }
            correctResponses[attendee.name].correctQuestions.push(i);
            correctResponses[attendee.name].confidenceValue += <number>attendee.responses[i].confidence;
            correctResponses[attendee.name].responseTime += <number>attendee.responses[i].responseTime;

            memberGroupResults[memberGroup.name].correctQuestions.push(i);
            memberGroupResults[memberGroup.name].responseTime += <number>attendee.responses[i].responseTime;

          } else if (isCorrect === 0) {

            if (!partiallyCorrectResponses[attendee.name]) {
              partiallyCorrectResponses[attendee.name] = {
                responseTime: 0,
                correctQuestions: [],
                confidenceValue: 0,
              };
            }

            partiallyCorrectResponses[attendee.name].correctQuestions.push(i);
            partiallyCorrectResponses[attendee.name].confidenceValue += <number>attendee.responses[i].confidence;
            partiallyCorrectResponses[attendee.name].responseTime += <number>attendee.responses[i].responseTime;

          } else {

            delete correctResponses[attendee.name];
            delete partiallyCorrectResponses[attendee.name];
            break;
          }
        }
      });
    });

    if (orderByGroups) {
      Object.keys(memberGroupResults).forEach(groupName => {
        const memberGroup = memberGroupResults[groupName];
        const maxMembersPerGroup = activeQuiz.originalObject.sessionConfig.nicks.maxMembersPerGroup;
        // (10 / 1) * (1 / 1) * (1.815 / 1)
        memberGroupResults[groupName].score = Math.round((
                                                           maxMembersPerGroup / memberGroup.memberAmount
                                                         ) * (
                                                           memberGroup.correctQuestions.length / activeQuiz.originalObject.questionList.length
                                                         ) * (
                                                           memberGroup.responseTime / memberGroup.memberAmount
                                                         ) * 100);
      });
    }

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.GET_LEADERBOARD_DATA,
      payload: {
        correctResponses: this._leaderboard.objectToArray(correctResponses),
        partiallyCorrectResponses: this._leaderboard.objectToArray(partiallyCorrectResponses),
        memberGroupResults: this._leaderboard.objectToArray(memberGroupResults),
      },
    };
  }

  @Get('/')
  private getAll(): object {
    return {};
  }
}
