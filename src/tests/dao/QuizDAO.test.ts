import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import DbDAO from '../../db/DbDAO';
import QuizDAO from '../../db/QuizDAO';
import { QuizState } from '../../enums/QuizState';
import { generateQuiz } from '../fixtures';

const expect = chai.expect;

@suite
class QuizDAOTestSuite {
  public quiz;

  public async after(): Promise<void> {
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
}
