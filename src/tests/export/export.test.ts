/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as assert from 'assert';
import * as fs from 'fs';
import * as i18n from 'i18n';
import * as MessageFormat from 'messageformat';
import { slow, suite, test } from 'mocha-typescript';
import * as path from 'path';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { FreeTextAnswerEntity } from '../../entities/answer/FreetextAnwerEntity';
import { MemberEntity } from '../../entities/member/MemberEntity';
import { FreeTextQuestionEntity } from '../../entities/question/FreeTextQuestionEntity';
import { RangedQuestionEntity } from '../../entities/question/RangedQuestionEntity';
import { SurveyQuestionEntity } from '../../entities/question/SurveyQuestionEntity';
import { QuizEntity } from '../../entities/quiz/QuizEntity';
import { SessionConfigurationEntity } from '../../entities/session-configuration/SessionConfigurationEntity';
import { QuestionType } from '../../enums/QuestionType';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';

@suite
class ExcelExportTestSuite {
  private _hashtag = 'mocha-export-test';
  private _memberCount = 20;
  private _theme = 'theme-Material';
  private _language = 'en';
  private _date: Date = new Date();
  private _dateDay = `${this._date.getDate()}_${this._date.getMonth() + 1}_${this._date.getFullYear()}`;
  private _dateFormatted = `${this._dateDay}-${this._date.getHours()}_${this._date.getMinutes()}`;
  private _exportLocation = path.join(__dirname, '..', '..', '..', 'test-generated', `Export-${this._hashtag}-${this._dateFormatted}.xlsx`);

  public static before(): void {
    i18n.configure({
      // setup some locales - other locales default to en silently
      locales: ['en'],
      defaultLocale: 'en',

      // where to store json files - defaults to './locales' relative to modules directory
      directory: path.join(staticStatistics.pathToAssets, 'i18n'),

      // what to use as the indentation unit - defaults to "\t"
      indent: '\t',

      // setting extension of json files - defaults to '.json' (you might want to set this to '.js' according to webtranslateit)
      extension: '.json',

      // setting prefix of json files name - default to none ''
      // (in case you use different locale files naming scheme (webapp-en.json), rather then just en.json)
      prefix: '',

      // enable object notation
      objectNotation: true,

      // setting of log level DEBUG - default to require('debug')('i18n:debug')
      logDebugFn: require('debug')('i18n:debug'),

      // setting of log level WARN - default to require('debug')('i18n:warn')
      logWarnFn: require('debug')('i18n:warn'),

      // setting of log level ERROR - default to require('debug')('i18n:error')
      logErrorFn: msg => {
        LoggerService.error('error', msg);
      },

      // object or [obj1, obj2] to bind the i18n api and current locale to - defaults to null
      register: global,

      // hash to specify different aliases for i18n's internal methods to apply on the request/response objects (method -> alias).
      // note that this will *not* overwrite existing properties with the same name
      api: {
        '__': 't',  // now req.__ becomes req.t
        '__n': 'tn', // and req.__n can be called as req.tn
      },
    });
    i18n.init(<any>{}, <any>{});
    const basedir = path.join(__dirname, '..', '..', '..', 'test-generated');
    if (!fs.existsSync(basedir)) {
      fs.mkdirSync(basedir);
    }
  }

  public static after(): void {
    QuizDAO.removeQuiz(QuizDAO.getQuizByName('mocha-export-test').id);
  }

  public randomIntFromInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  @test
  public async initQuiz(): Promise<void> {
    QuizDAO.addQuiz(new QuizEntity({
      name: this._hashtag,
      questionList: [],
      sessionConfig: new SessionConfigurationEntity(),
      privateKey: 'test',
      readingConfirmationRequested: false,
    }).serialize());
    await assert.equal(!QuizDAO.isActiveQuiz(this._hashtag), true, 'Expected to find an inactive quiz item');

    const quiz: IQuizEntity = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;
    QuizDAO.initQuiz(quiz);

    await assert.equal(QuizDAO.isActiveQuiz(this._hashtag), true, 'Expected to find an active quiz item');
  }

  @test
  public async addMembers(): Promise<void> {
    const quiz = QuizDAO.getActiveQuizByName(this._hashtag);
    for (let memberIndex = 0; memberIndex < this._memberCount; memberIndex++) {
      MemberDAO.getMembersOfQuiz(quiz.name).push(new MemberEntity({
        name: `testnick${memberIndex + 1}`,
        groupName: 'Default',
        currentQuizName: quiz.name,
        token: 'testnick',
      }));
    }
    await assert.equal(MemberDAO.getMembersOfQuiz(quiz.name).length, this._memberCount, `Expected that the quiz has ${this._memberCount} members`);
  }

  @test
  public async addResponses(): Promise<void> {
    const quiz = QuizDAO.getActiveQuizByName(this._hashtag);
    for (let questionIndex = 0; questionIndex < quiz.questionList.length; questionIndex++) {
      const question = quiz.questionList[questionIndex];
      for (let memberIndex = 0; memberIndex < this._memberCount; memberIndex++) {
        let value;
        let parsedQuestion;
        let useCorrect;
        switch (question.TYPE) {
          case QuestionType.YesNoSingleChoiceQuestion:
          case QuestionType.TrueFalseSingleChoiceQuestion:
            value = [this.randomIntFromInterval(0, 1)];
            break;
          case QuestionType.SurveyQuestion:
            parsedQuestion = (<SurveyQuestionEntity>question);
            if (parsedQuestion.multipleSelectionEnabled) {
              value = [];
              for (let i = 0; i < 3; i++) {
                const generatedValue = this.randomIntFromInterval(0, question.answerOptionList.length - 1);
                if (value.indexOf(generatedValue) > -1) {
                  continue;
                }
                value.push(generatedValue);
              }
            } else {
              value = [this.randomIntFromInterval(0, question.answerOptionList.length - 1)];
            }
            break;
          case QuestionType.SingleChoiceQuestion:
          case QuestionType.ABCDSingleChoiceQuestion:
            value = [this.randomIntFromInterval(0, question.answerOptionList.length - 1)];
            break;
          case QuestionType.MultipleChoiceQuestion:
            value = [];
            for (let i = 0; i < 3; i++) {
              const generatedValue = this.randomIntFromInterval(0, question.answerOptionList.length - 1);
              if (value.indexOf(generatedValue) > -1) {
                continue;
              }
              value.push(generatedValue);
            }
            break;
          case QuestionType.RangedQuestion:
            parsedQuestion = (<RangedQuestionEntity>question);
            useCorrect = Math.random() > 0.5;
            if (useCorrect) {
              value = parsedQuestion.correctValue;
            } else {
              value = this.randomIntFromInterval(parsedQuestion.rangeMin, parsedQuestion.rangeMax);
            }
            break;
          case QuestionType.FreeTextQuestion:
            const parsedAnswer: FreeTextAnswerEntity = <FreeTextAnswerEntity>(<FreeTextQuestionEntity>question).answerOptionList[0];
            useCorrect = Math.random() > 0.5;
            if (useCorrect) {
              value = parsedAnswer.answerText;
            } else {
              value = parsedAnswer.answerText.split('').reverse().join('');
            }
            break;
          default:
            throw new Error(`Unsupported question type ${question.TYPE}`);
        }
        const responses = [
          {
            value: value,
            responseTime: this.randomIntFromInterval(0, quiz.questionList[questionIndex].timer),
            confidence: this.randomIntFromInterval(0, 100),
            readingConfirmation: true,
          },
        ];
      }
    }
  }

  @test(slow(500))
  public async generateExcelWorkbook(): Promise<void> {
    const quiz = QuizDAO.getActiveQuizByName(this._hashtag);
    const wb = new ExcelWorkbook({
      themeName: this._theme,
      translation: this._language,
      quiz: quiz,
      mf: (i18n.__mf as unknown as MessageFormat),
    });

    const buffer = await wb.writeToBuffer();
    fs.open(this._exportLocation, 'w', (err, fd) => {
      if (err) {
        throw new Error('error opening file: ' + err);
      }

      fs.write(fd, buffer, 0, buffer.length, null, (error) => {
        if (error) {
          throw new Error('error writing file: ' + error);
        }
        fs.closeSync(fd);
      });
    });
  }

  @test
  public async checkWorkbookExisting(): Promise<void> {
    await assert.ok(fs.readFileSync(this._exportLocation), 'Expected Excel workbook to exist');
  }
}
