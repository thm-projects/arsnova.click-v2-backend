/* tslint:disable:no-unused-expression */
import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import DbDAO from '../../db/DbDAO';
import QuizDAO from '../../db/QuizDAO';
import { QuizState } from '../../enums/QuizState';
import { QuizVisibility } from '../../enums/QuizVisibility';
import { QuizModel } from '../../models/quiz/QuizModelItem';
import { generateLegacyQuiz, generateQuiz } from '../fixtures';

const expect = chai.expect;

@suite
class QuizDAOTestSuite {
  public quiz;

  public async after(): Promise<void> {
    Object.keys(QuizDAO['_storage']).forEach(v => {
      clearInterval(QuizDAO['_storage'][v].quizTimerInterval);
      clearInterval(QuizDAO['_storage'][v].emptyQuizInterval);
      delete QuizDAO['_storage'][v];
    });
    await Promise.all(Object.keys(DbDAO.dbCon.collections).map(c => DbDAO.dbCon.collection(c).deleteMany({})));
  }

  @test
  public async getInactiveQuizzes(): Promise<void> {
    this.quiz = generateQuiz('test-quiz');
    this.quiz.state = QuizState.Inactive;
    await QuizDAO.addQuiz(this.quiz);

    const quizze = await QuizDAO.getInactiveQuizzes();
    expect(quizze[0].toJSON()).to.deep.include(this.quiz);
  }

  @test
  public async getActiveQuizzes(): Promise<void> {
    const quiz = await QuizDAO.addQuiz(generateQuiz('test-quiz'));
    await QuizDAO.updateQuiz(quiz._id, {
      state: QuizState.Running,
    });
    this.quiz = await QuizDAO.getQuizById(quiz._id);

    const quizze = await QuizDAO.getActiveQuizzes();
    expect(quizze[0].toJSON()).to.deep.include(this.quiz.toJSON());
  }

  @test
  public async getJoinableQuizzes(): Promise<void> {
    const quiz = await QuizDAO.addQuiz(generateQuiz('test-quiz'));
    await QuizDAO.updateQuiz(quiz._id, {
      state: QuizState.Active,
    });
    this.quiz = await QuizDAO.getQuizById(quiz._id);

    const quizze = await QuizDAO.getJoinableQuizzes();
    expect(quizze[0].toJSON()).to.deep.include(this.quiz.toJSON());
  }

  @test
  public async getRenameRecommendations(): Promise<void> {
    await QuizDAO.addQuiz(generateQuiz('test-quiz'));

    const recommendations = await QuizDAO.getRenameRecommendations('test-quiz');
    expect(recommendations.length).to.equal(3);
    expect(recommendations[0]).to.equal('test-quiz 2');
  }

  @test
  public async getLastPersistedDemoQuizNumber(): Promise<void> {
    await QuizDAO.addQuiz(generateQuiz('demo quiz 5'));

    const demoQuizNumber = await QuizDAO.getLastPersistedDemoQuizNumber();
    expect(demoQuizNumber).to.equal(5);
  }

  @test
  public async getLastPersistedAbcdQuizNumberByLength(): Promise<void> {
    await QuizDAO.addQuiz(generateQuiz('abcdef 3'));

    const abcdefNumber = await QuizDAO.getLastPersistedAbcdQuizNumberByLength(6);
    const abNumber = await QuizDAO.getLastPersistedAbcdQuizNumberByLength(2);

    expect(abcdefNumber).to.equal(3);
    expect(abNumber).to.equal(0);
  }

  @test
  public async convertLegacyQuiz(): Promise<void> {
    const legacyQuiz = generateLegacyQuiz('test-quiz');

    const quiz: any = await QuizDAO.convertLegacyQuiz(JSON.parse(JSON.stringify(legacyQuiz)));

    expect(quiz.configuration).to.be.undefined;
    expect(quiz.sessionConfig.theme).to.equal(legacyQuiz.configuration.theme);
    expect(quiz.name).to.equal(legacyQuiz.hashtag);
  }

  @test
  public async addQuiz(): Promise<void> {
    const quiz = generateQuiz('test-quiz');

    await QuizDAO.addQuiz(quiz);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz).to.not.be.undefined;
  }

  @test
  public async updateQuiz(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    const addedQuiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.updateQuiz(addedQuiz._id, { state: QuizState.Active });
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.state).to.equal(QuizState.Active);
  }

  @test
  public async getQuizByName(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    await QuizDAO.addQuiz(quiz);
    const daoQuiz = await QuizDAO.getQuizByName('test-quiz');
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(daoQuiz).to.deep.equal(dbQuiz);
  }

  @test
  public async getQuizForAttendee(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    await QuizDAO.addQuiz(quiz);
    const dbQuiz = await QuizDAO.getQuizForAttendee('test-quiz');

    expect(dbQuiz).to.not.include.keys(['privateKey']);
  }

  @test
  public async getExpiryQuizzes(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    quiz.expiry = new Date(new Date().getTime() + 20000);
    await QuizDAO.addQuiz(quiz);
    const quizzes = await QuizDAO.getExpiryQuizzes();

    expect(quizzes.length).to.equal(1);
    expect(quizzes[0].toJSON()).to.deep.contain(quiz);
  }

  @test
  public async initQuiz(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    const addedQuiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.initQuiz(addedQuiz);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(QuizDAO['_storage']['test-quiz']).to.not.be.undefined;
    expect(dbQuiz.state).to.equal(QuizState.Active);
  }

  @test
  public async getAllQuizzes(): Promise<void> {
    const quiz1 = generateQuiz('test-quiz');
    const quiz2 = generateQuiz('second-test-quiz');
    await QuizDAO.addQuiz(quiz1);
    await QuizDAO.addQuiz(quiz2);
    const quizzes = await QuizDAO.getAllQuizzes();

    expect(quizzes.length).to.equal(2);
    expect(quizzes[0].toJSON()).to.deep.contain(quiz1);
    expect(quizzes[1].toJSON()).to.deep.contain(quiz2);
  }

  @test
  public async isActiveQuiz(): Promise<void> {
    const quiz1 = generateQuiz('test-quiz');
    quiz1.state = QuizState.Active;
    await QuizDAO.addQuiz(quiz1);
    const quiz2 = generateQuiz('second-test-quiz');
    await QuizDAO.addQuiz(quiz2);
    const quiz1Active = await QuizDAO.isActiveQuiz('test-quiz');
    const quiz2Active = await QuizDAO.isActiveQuiz('second-test-quiz');

    expect(quiz1Active).to.be.true;
    expect(quiz2Active).to.be.false;
  }

  @test
  public async setQuizAsInactive(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    quiz.state = QuizState.Active;
    await QuizDAO.addQuiz(quiz);
    await QuizDAO.setQuizAsInactive('test-quiz', quiz.privateKey);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.state).to.equal(QuizState.Inactive);
  }

  @test
  public async getActiveQuizByName(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    quiz.state = QuizState.Active;
    await QuizDAO.addQuiz(quiz);
    const activeQuiz = await QuizDAO.getActiveQuizByName('test-quiz');

    expect(activeQuiz.toJSON()).to.deep.contain(quiz);
  }

  @test
  public async getAllPublicQuizzes(): Promise<void> {
    const quiz1 = generateQuiz('test-quiz');
    quiz1.visibility = QuizVisibility.Any;
    quiz1.expiry = new Date(new Date().getTime() + 20000);
    await QuizDAO.addQuiz(quiz1);
    const quiz2 = generateQuiz('second-test-quiz');
    quiz2.visibility = QuizVisibility.Account;
    quiz2.expiry = new Date(new Date().getTime() + 20000);
    await QuizDAO.addQuiz(quiz2);
    const quizzes = await QuizDAO.getAllPublicQuizzes();

    expect(quizzes.length).to.equal(1);
    expect(quizzes[0].toJSON()).to.deep.contain(quiz1);
  }

  @test
  public async getPublicQuizByName(): Promise<void> {
    const quiz1 = generateQuiz('test-quiz');
    quiz1.visibility = QuizVisibility.Any;
    quiz1.expiry = new Date(new Date().getTime() + 20000);
    await QuizDAO.addQuiz(quiz1);
    const quiz2 = generateQuiz('second-test-quiz');
    quiz2.visibility = QuizVisibility.Account;
    quiz2.expiry = new Date(new Date().getTime() + 20000);
    await QuizDAO.addQuiz(quiz2);
    const publicQuiz1 = await QuizDAO.getPublicQuizByName('test-quiz');
    const publicQuiz2 = await QuizDAO.getPublicQuizByName('second-test-quiz');

    expect(publicQuiz1.toJSON()).to.deep.contain(quiz1);
    expect(publicQuiz2).to.be.null;
  }

  @test
  public async getRenameAsToken(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    await QuizDAO.addQuiz(quiz);
    const token = await QuizDAO.getRenameAsToken('test-quiz');

    expect(token).to.not.be.undefined;
  }

  @test
  public async removeQuizByName(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    await QuizDAO.addQuiz(quiz);
    await QuizDAO.removeQuizByName('test-quiz');
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz).to.be.null;
  }

  @test
  public async resetQuiz(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    await QuizDAO.addQuiz(quiz);
    await QuizDAO.resetQuiz('test-quiz', quiz.privateKey);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.state).to.equal(QuizState.Active);
  }

  @test
  public async nextQuestion(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    const daoquiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.nextQuestion(daoquiz);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.currentQuestionIndex).to.equal(0);
  }

  @test
  public async requestReadingConfirmation(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    const daoquiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.requestReadingConfirmation(daoquiz);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.readingConfirmationRequested).to.equal(true);
  }

  @test
  public async startNextQuestion(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    quiz.currentQuestionIndex = 0;
    const daoquiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.startNextQuestion(daoquiz);

    expect(QuizDAO['_storage']['test-quiz'].quizTimer).to.equal(quiz.questionList[quiz.currentQuestionIndex].timer);
  }

  @test
  public async stopQuiz(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    quiz.currentStartTimestamp = 20;
    const daoquiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.stopQuiz(daoquiz);
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.currentStartTimestamp).to.equal(-1);
  }

  @test
  public async updateQuizSettings(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    quiz.sessionConfig.readingConfirmationEnabled = true;
    const daoquiz = await QuizDAO.addQuiz(quiz);
    await QuizDAO.updateQuizSettings(daoquiz, { target: 'readingConfirmationEnabled', state: false });
    const dbQuiz = await QuizModel.findOne({ name: 'test-quiz' }).exec();

    expect(dbQuiz.sessionConfig.readingConfirmationEnabled).to.equal(false);
  }

  @test
  public async getQuizzesByPrivateKey(): Promise<void> {
    const quiz1 = generateQuiz('test-quiz');
    await QuizDAO.addQuiz(quiz1);
    const quiz2 = generateQuiz('test-quiz2');
    await QuizDAO.addQuiz(quiz2);
    const quiz3 = generateQuiz('test-quiz3');
    quiz3.privateKey = String(Math.random());
    await QuizDAO.addQuiz(quiz3);

    const quizzes = await QuizDAO.getQuizzesByPrivateKey(quiz1.privateKey);

    expect(quizzes.length).to.equal(2);
    expect(quizzes).to.not.deep.include(quiz3);
  }

  @test
  public async getQuizById(): Promise<void> {
    const quiz = generateQuiz('test-quiz');
    const addedQuiz = await QuizDAO.addQuiz(quiz);
    const dbQuiz = await QuizDAO.getQuizById(addedQuiz._id);

    expect(dbQuiz.toJSON()).to.deep.contain(quiz);
  }
}
