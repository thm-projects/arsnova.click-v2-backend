/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as assert from 'assert';
import * as fs from 'fs';
import * as i18n from 'i18n';
import * as MessageFormat from 'messageformat';
import { skip, slow, suite, test } from 'mocha-typescript';
import { Document } from 'mongoose';
import * as path from 'path';
import * as sinon from 'sinon';
import AMQPConnector from '../../db/AMQPConnector';
import MemberDAO from '../../db/MemberDAO';
import MongoDBConnector from '../../db/MongoDBConnector';
import QuizDAO from '../../db/quiz/QuizDAO';
import { QuestionType } from '../../enums/QuestionType';
import { QuizState } from '../../enums/QuizState';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';
import { IQuestionSurvey } from '../../interfaces/questions/IQuestionSurvey';
import { QuizModelItem } from '../../models/quiz/QuizModelItem';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';
import { generateQuiz } from '../fixtures';

@suite @skip
class ExcelExportTestSuite {
  private readonly _hashtag = 'mocha-export-test';
  private _memberCount = 20;
  private _theme = 'theme-Material';
  private _language = 'en';
  private _date: Date = new Date();
  private _dateDay = `${this._date.getDate()}_${this._date.getMonth() + 1}_${this._date.getFullYear()}`;
  private _dateFormatted = `${this._dateDay}-${this._date.getHours()}_${this._date.getMinutes()}`;
  private _exportLocation = path.join(__dirname, '..', '..', '..', 'test-generated', `Export-${this._hashtag}-${this._dateFormatted}.xlsx`);

  public static before(): void {
    i18n.configure({
      locales: ['en'],
      defaultLocale: 'en',
      directory: path.join(staticStatistics.pathToAssets, 'i18n'),
      indent: '\t',
      extension: '.json',
      prefix: '',
      objectNotation: true,
      logDebugFn: require('debug')('i18n:debug'),
      logWarnFn: require('debug')('i18n:warn'),
      logErrorFn: msg => {
        LoggerService.error('error', msg);
      },
      register: global,
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

  public async after(): Promise<void> {
    await QuizDAO.removeQuiz((await QuizDAO.getQuizByName(this._hashtag)).id);
  }

  public async before(): Promise<void> {
    const sandbox = sinon.createSandbox();
    sandbox.stub(AMQPConnector, 'channel').value({
      assertExchange: () => {},
      publish: () => {},
    });
    sandbox.stub(MongoDBConnector, 'connect').value({ assertExchange: () => {} });

    const doc = await QuizDAO.addQuiz(generateQuiz(this._hashtag));
    assert.equal(QuizDAO.isActiveQuiz(this._hashtag), false, 'Expected to find an inactive quiz item');

    const quiz: Document & QuizModelItem = JSON.parse(
      fs.readFileSync(path.join(staticStatistics.pathToAssets, 'predefined_quizzes', 'demo_quiz', 'en.demo_quiz.json')).toString('UTF-8'));
    quiz.name = this._hashtag;
    quiz._id = doc._id;
    quiz.state = QuizState.Active;
    await QuizDAO.initQuiz(quiz);
  }

  public randomIntFromInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  @test
  public initQuiz(): void {
    assert.equal(QuizDAO.isActiveQuiz(this._hashtag), true, 'Expected to find an active quiz item');
  }

  @test
  public async addMembers(): Promise<void> {
    const quiz = await QuizDAO.getActiveQuizByName(this._hashtag);
    for (let memberIndex = 0; memberIndex < this._memberCount; memberIndex++) {
      await MemberDAO.addMember({
        name: `testnick${memberIndex + 1}`,
        groupName: 'Default',
        currentQuizName: quiz.name,
        token: 'testnick',
      });
    }
    await assert.equal((await MemberDAO.getMembersOfQuiz(quiz.name)).length, this._memberCount,
      `Expected that the quiz has ${this._memberCount} members`);
  }

  @test
  public async addResponses(): Promise<void> {
    const quiz = await QuizDAO.getActiveQuizByName(this._hashtag);
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
            parsedQuestion = question as IQuestionSurvey;
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
            parsedQuestion = question as IQuestionRanged;
            useCorrect = Math.random() > 0.5;
            if (useCorrect) {
              value = parsedQuestion.correctValue;
            } else {
              value = this.randomIntFromInterval(parsedQuestion.rangeMin, parsedQuestion.rangeMax);
            }
            break;
          case QuestionType.FreeTextQuestion:
            const parsedAnswer = question.answerOptionList[0];
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
    const quiz = await QuizDAO.getActiveQuizByName(this._hashtag);
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
