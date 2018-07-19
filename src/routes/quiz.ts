import { IAnswerOption } from 'arsnova-click-v2-types/src/answeroptions/interfaces';
import { IActiveQuiz, IMemberGroupSerialized } from 'arsnova-click-v2-types/src/common';
import { IQuestion, IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import { ISessionConfiguration } from 'arsnova-click-v2-types/src/session_configuration/interfaces';
import { NextFunction, Request, Response, Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { MatchTextToAssetsDb } from '../cache/assets';
import { default as DbDAO } from '../db/DbDAO';
import QuizManagerDAO from '../db/QuizManagerDAO';
import { DATABASE_TYPE } from '../Enums';
import { ExcelWorkbook } from '../export/excel-workbook';
import { Leaderboard } from '../leaderboard/leaderboard';
import { settings, staticStatistics } from '../statistics';

export class QuizRouter {
  get router(): Router {
    return this._router;
  }

  private readonly _router: Router;
  private _leaderboard: Leaderboard = new Leaderboard();

  /**
   * Initialize the QuizRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public getIsAvailableQuiz(req: Request, res: Response): void {
    interface IisAvailableQuizPayload {
      available?: boolean;
      provideNickSelection?: boolean;
      authorizeViaCas?: boolean;
      memberGroups?: Array<IMemberGroupSerialized>;
      maxMembersPerGroup?: number;
      autoJoinToGroup?: boolean;
    }

    const quiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    const payload: IisAvailableQuizPayload = {};

    const isInactive: boolean = QuizManagerDAO.isInactiveQuiz(req.params.quizName);
    let isInProgress = false;

    if (quiz) {
      if (quiz.currentQuestionIndex === -1) {
        const sessionConfig: ISessionConfiguration = QuizManagerDAO.getActiveQuizByName(req.params.quizName).originalObject.sessionConfig;
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

    const result: Object = {
      status: `STATUS:SUCCESSFUL`,
      step: `QUIZ:${quiz && !isInProgress ? 'AVAILABLE' : isInactive || isInProgress ? 'EXISTS' : 'UNDEFINED'}`,
      payload,
    };
    res.send(result);
  }

  public generateDemoQuiz(req: Request, res: Response): void {
    try {
      const basePath = path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz');
      let demoQuizPath = path.join(basePath, `${req.params.languageId.toLowerCase()}.demo_quiz.json`);
      if (!fs.existsSync(demoQuizPath)) {
        demoQuizPath = path.join(basePath, 'en.demo_quiz.json');
      }
      const result: IQuestionGroup = JSON.parse(fs.readFileSync(demoQuizPath).toString());
      result.hashtag = 'Demo Quiz ' + (
                       QuizManagerDAO.getLastPersistedDemoQuizNumber() + 1
      );
      QuizManagerDAO.convertLegacyQuiz(result);
      res.setHeader('Response-Type', 'application/json');
      res.send(result);
    } catch (ex) {
      res.send(`File IO Error: ${ex}`);
    }
  }

  public generateAbcdQuiz(req: Request, res: Response): void {
    try {
      const answerLength = req.params.answerLength || 4;
      const basePath = path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'abcd_quiz');
      let abcdQuizPath = path.join(basePath, `${req.params.languageId.toLowerCase()}.abcd_quiz.json`);
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
      res.send(result);
    } catch (ex) {
      res.send(`File IO Error: ${ex}`);
    }
  }

  public uploadQuiz(req: IUploadRequest, res: Response): void {
    const duplicateQuizzes = [];
    const quizData = [];
    let privateKey = '';
    if (req.busboy) {
      const promise = new Promise((resolve) => {
        req.busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
          if (fieldname === 'uploadFiles[]') {
            let quiz = '';
            file.on('data', (buffer) => {
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
        res.send({
          status: 'STATUS:SUCCESSFUL',
          step: 'QUIZ:UPLOAD_FILE',
          payload: { duplicateQuizzes },
        });
      });
    } else {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:UPLOAD_FILE',
        payload: { message: 'busboy not found' },
      });
    }
  }

  public startQuiz(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:START:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    if (activeQuiz.currentStartTimestamp) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:ALREADY_STARTED',
        payload: {
          startTimestamp: activeQuiz.currentStartTimestamp,
          nextQuestionIndex: activeQuiz.currentQuestionIndex,
        },
      });
    } else {
      const nextQuestionIndex = activeQuiz.originalObject.sessionConfig.readingConfirmationEnabled ? activeQuiz.currentQuestionIndex
                                                                                                   : activeQuiz.nextQuestion();

      if (nextQuestionIndex === -1) {
        res.send({
          status: 'STATUS:FAILED',
          step: 'QUIZ:END_OF_QUESTIONS',
          payload: {},
        });
      } else {
        const startTimestamp: number = new Date().getTime();
        activeQuiz.setTimestamp(startTimestamp);
        res.send({
          status: 'STATUS:SUCCESSFUL',
          step: 'QUIZ:START',
          payload: {
            startTimestamp,
            nextQuestionIndex,
          },
        });
      }
    }
  }

  public stopQuiz(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:STOP:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    activeQuiz.stop();
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:STOP',
      payload: {},
    });
  }

  public getCurrentQuizState(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:CURRENT_STATE:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    const index = activeQuiz.currentQuestionIndex < 0 ? 0 : activeQuiz.currentQuestionIndex;
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:CURRENT_STATE',
      payload: {
        questions: activeQuiz.originalObject.questionList.slice(0, index + 1),
        questionIndex: index,
        startTimestamp: activeQuiz.currentStartTimestamp,
        numberOfQuestions: activeQuiz.originalObject.questionList.length,
      },
    });
  }

  public showReadingConfirmation(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:READING_CONFIRMATION_REQUESTED:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    activeQuiz.nextQuestion();
    activeQuiz.requestReadingConfirmation();
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:READING_CONFIRMATION_REQUESTED',
      payload: {},
    });
  }

  public getQuizStartTime(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:GET_STARTTIME:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_STARTTIME',
      payload: { startTimestamp: activeQuiz.currentStartTimestamp },
    });
  }

  public getQuizSettings(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:SETTINGS:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:SETTINGS',
      payload: { settings: activeQuiz.originalObject.sessionConfig },
    });
  }

  public updateQuizSettings(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:UPDATED_SETTINGS:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    activeQuiz.updateQuizSettings(req.body.target, req.body.state);
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:UPDATED_SETTINGS',
      payload: {},
    });
  }

  public reserveQuiz(req: Request, res: Response): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.send(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {},
      }));
      return;
    }
    const activeQuizzesAmount = QuizManagerDAO.getAllActiveQuizNames();
    if (activeQuizzesAmount.length >= settings.public.limitActiveQuizzes) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:TOO_MUCH_ACTIVE_QUIZZES',
        payload: {
          activeQuizzes: activeQuizzesAmount,
          limitActiveQuizzes: settings.public.limitActiveQuizzes,
        },
      });
      return;
    }
    if (settings.public.createQuizPasswordRequired) {
      if (!req.body.serverPassword) {
        res.send({
          status: 'STATUS:FAILED',
          step: 'QUIZ:SERVER_PASSWORD_REQUIRED',
          payload: {},
        });
        return;
      }
      if (req.body.serverPassword !== settings.createQuizPassword) {
        res.send(JSON.stringify({
          status: 'STATUS:FAILED',
          step: 'QUIZ:INSUFFICIENT_PERMISSIONS',
          payload: {},
        }));
        return;
      }
    }
    QuizManagerDAO.initInactiveQuiz(req.body.quizName);
    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: req.body.quizName,
      privateKey: req.body.privateKey,
    });
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:RESERVED',
      payload: {},
    });
  }

  public reserveQuizWithOverride(req: Request, res: Response): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {},
      }));
      return;
    }
    QuizManagerDAO.initInactiveQuiz(req.body.quizName);
    DbDAO.create(DATABASE_TYPE.QUIZ, {
      quizName: req.body.quizName,
      privateKey: req.body.privateKey,
    });
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:RESERVED',
      payload: {},
    });
  }

  public deleteQuiz(req: Request, res: Response): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {},
      }));
      return;
    }
    const dbResult: boolean = DbDAO.delete(DATABASE_TYPE.QUIZ, {
      quizName: req.body.quizName,
      privateKey: req.body.privateKey,
    });
    if (dbResult) {
      QuizManagerDAO.removeQuiz(req.body.quizName);
      res.send({
        status: 'STATUS:SUCCESSFUL',
        step: 'QUIZ:REMOVED',
        payload: {},
      });
    } else {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INSUFFICIENT_PERMISSIONS',
        payload: {},
      }));
    }
  }

  public deleteActiveQuiz(req: Request, res: Response): void {
    if (!req.body.quizName || !req.body.privateKey) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INVALID_DATA',
        payload: {},
      });
      return;
    }
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.body.quizName);
    const dbResult: Object = DbDAO.read(DATABASE_TYPE.QUIZ, {
      quizName: req.body.quizName,
      privateKey: req.body.privateKey,
    });

    if (!dbResult) {
      res.send({
        status: 'STATUS:FAILED',
        step: 'QUIZ:INSUFFICIENT_PERMISSIONS',
        payload: {},
      });
      return;
    }

    if (activeQuiz) {
      activeQuiz.onDestroy();
      QuizManagerDAO.setQuizAsInactive(req.body.quizName);
      res.send({
        status: 'STATUS:SUCCESSFUL',
        step: 'QUIZ:CLOSED',
        payload: {},
      });
      return;
    }
  }

  public resetQuiz(req: Request, res: Response): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'QUIZ:RESET:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }
    activeQuiz.reset();
    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:RESET',
      payload: {},
    });
  }

  public getExportFile(req: Request, res: I18nResponse): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    const dbResult: Object = DbDAO.read(DATABASE_TYPE.QUIZ, {
      quizName: req.params.quizName,
      privateKey: req.params.privateKey,
    });

    if (!dbResult) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'EXPORT:QUIZ_NOT_FOUND',
        payload: {},
      }));
      return;
    }
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'EXPORT:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }

    // TODO: The quiz contains the rewritten cached asset urls. Restore them to the original value!

    const wb = new ExcelWorkbook({
      themeName: req.params.theme,
      translation: req.params.language,
      quiz: activeQuiz,
      mf: res.__mf,
    });
    const date: Date = new Date();
    const dateFormatted = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}-${date.getHours()}_${date.getMinutes()}`;
    wb.write(`Export-${req.params.quizName}-${dateFormatted}.xlsx`, res);
  }

  private init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/generate/demo/:languageId', this.generateDemoQuiz);
    this._router.get('/generate/abcd/:languageId/:answerLength?', this.generateAbcdQuiz);
    this._router.get('/status/:quizName', this.getIsAvailableQuiz);
    this._router.get('/currentState/:quizName', this.getCurrentQuizState);
    this._router.get('/startTime/:quizName', this.getQuizStartTime);
    this._router.get('/settings/:quizName', this.getQuizSettings);
    this._router.get('/export/:quizName/:privateKey/:theme/:language', this.getExportFile);
    this._router.get('/leaderboard/:quizName/:questionIndex?', this.getLeaderBoardData.bind(this));

    this._router.post('/upload', this.uploadQuiz);
    this._router.post('/start', this.startQuiz);
    this._router.post('/stop', this.stopQuiz);
    this._router.post('/reading-confirmation', this.showReadingConfirmation);
    this._router.post('/settings/update', this.updateQuizSettings);
    this._router.post('/reserve', this.reserveQuiz);
    this._router.post('/reserve/override', this.reserveQuizWithOverride);

    this._router.patch('/reset/:quizName', this.resetQuiz);

    this._router.delete('/', this.deleteQuiz);
    this._router.delete('/active', this.deleteActiveQuiz);
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }

  private getLeaderBoardData(req: Request, res: Response, next: NextFunction): void {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(req.params.quizName);
    if (!activeQuiz) {
      res.sendStatus(500);
      res.end(JSON.stringify({
        status: 'STATUS:FAILED',
        step: 'GET_LEADERBOARD_DATA:QUIZ_INACTIVE',
        payload: {},
      }));
      return;
    }

    const index: number = +req.params.questionIndex;
    const questionAmount: number = activeQuiz.originalObject.questionList.length;
    const questionIndex: number = isNaN(index) ? 0 : index;
    const endIndex: number = isNaN(index) || index < 0 || index > questionAmount ? questionAmount : index + 1;
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

    res.send({
      status: 'STATUS:SUCCESSFUL',
      step: 'QUIZ:GET_LEADERBOARD_DATA',
      payload: {
        correctResponses: this._leaderboard.objectToArray(correctResponses),
        partiallyCorrectResponses: this._leaderboard.objectToArray(partiallyCorrectResponses),
        memberGroupResults: this._leaderboard.objectToArray(memberGroupResults),
      },
    });
  }
}

// Create the ApiRouter, and export its configured Express.Router
const quizRoutes = new QuizRouter();
const quizRouter = quizRoutes.router;
export { quizRouter };
