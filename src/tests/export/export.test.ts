/// <reference path="../../../node_modules/chai-http/types/index.d.ts" />

import * as assert from 'assert';
import * as fs from 'fs';
import * as i18n from 'i18n';
import * as MessageFormat from 'messageformat';
import { slow, suite, test, timeout } from 'mocha-typescript';
import * as path from 'path';
import DbDAO from '../../db/DbDAO';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/QuizDAO';
import { QuestionType } from '../../enums/QuestionType';
import { ExcelWorkbook } from '../../export/ExcelWorkbook';
import { IQuestionRanged } from '../../interfaces/questions/IQuestionRanged';
import { IQuestionSurvey } from '../../interfaces/questions/IQuestionSurvey';
import LoggerService from '../../services/LoggerService';
import { settings } from '../../statistics';
import { generateQuiz } from '../fixtures';

@suite
class ExcelExportTestSuite {
  private readonly _hashtag = 'mocha-export-test';
  private _memberCount = 20;
  private _theme = 'Material';
  private _language = 'en';
  private _date: Date = new Date();
  private _dateDay = `${this._date.getDate()}_${this._date.getMonth() + 1}_${this._date.getFullYear()}`;
  private _dateFormatted = `${this._dateDay}-${this._date.getHours()}_${this._date.getMinutes()}`;
  private _exportLocation = path.join(__dirname, '..', '..', '..', 'test-generated', `Export-${this._hashtag}-${this._dateFormatted}.xlsx`);

  public static async before(): Promise<void> {
    i18n.configure({
      locales: ['en'],
      defaultLocale: 'en',
      directory: path.join(settings.pathToAssets, 'i18n'),
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
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  public randomIntFromInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  @test @slow(5000) @timeout(5000)
  public async initQuiz(): Promise<void> {
    const doc = await QuizDAO.addQuiz(generateQuiz(this._hashtag));
    await QuizDAO.initQuiz(doc);
    const result = await QuizDAO.isActiveQuiz(this._hashtag);

    assert.equal(result, true, 'Expected to find an active quiz item');
  }

  @test @slow(5000) @timeout(5000)
  public async addMembers(): Promise<void> {
    const doc = await QuizDAO.addQuiz(generateQuiz(this._hashtag));
    await QuizDAO.initQuiz(doc);

    for (let memberIndex = 0; memberIndex < this._memberCount; memberIndex++) {
      await MemberDAO.addMember({
        name: `testnick${memberIndex + 1}`,
        groupName: 'Default',
        currentQuizName: doc.name,
        token: 'testnick',
      });
    }

    const result = await MemberDAO.getMembersOfQuizForOwner(doc.name);
    await assert.equal(result.length, this._memberCount, `Expected that the quiz has ${this._memberCount} members`);
  }

  @test
  public async addResponses(): Promise<void> {
    const doc = await QuizDAO.addQuiz(generateQuiz(this._hashtag));
    await QuizDAO.initQuiz(doc);

    for (let questionIndex = 0; questionIndex < doc.questionList.length; questionIndex++) {
      const question = doc.questionList[questionIndex];
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
          case QuestionType.ABCDSurveyQuestion:
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
      }
    }
  }

  @test(slow(500))
  public async generateExcelWorkbook(): Promise<void> {
    const doc = await QuizDAO.addQuiz(generateQuiz(this._hashtag));
    await QuizDAO.initQuiz(doc);

    const wb = new ExcelWorkbook({
      themeName: this._theme,
      translation: this._language,
      quiz: doc.toJSON(),
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
