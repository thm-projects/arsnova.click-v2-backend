import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import * as sinon from 'sinon';
import QuizDAO from '../../db/QuizDAO';
import { QuizState } from '../../enums/QuizState';
import { QuizModel } from '../../models/quiz/QuizModelItem';
import { generateQuiz } from '../fixtures';

const expect = chai.expect;

@suite
class QuizDAOTestSuite {
  public quiz;
  public sandbox;

  public after(): void {}

  @test
  public async getInactiveQuizzes(): Promise<void> {
    this.quiz = generateQuiz('test-quiz');
    this.quiz.state = QuizState.Inactive;
    this.sandbox = sinon.createSandbox();
    this.sandbox.stub(QuizModel, 'find').value(() => (
      { exec: () => [this.quiz] }
    ));

    const quizze = await QuizDAO.getInactiveQuizzes();
    expect(quizze).to.include(this.quiz);

    this.sandbox.restore();
  }

  @test
  public async getActiveQuizzes(): Promise<void> {
    this.quiz = generateQuiz('test-quiz');
    this.quiz.state = QuizState.Running;
    this.sandbox = sinon.createSandbox();
    this.sandbox.stub(QuizModel, 'find').value(() => (
      { exec: () => [this.quiz] }
    ));

    const quizze = await QuizDAO.getActiveQuizzes();
    expect(quizze).to.include(this.quiz);

    this.sandbox.restore();
  }

  @test
  public async getJoinableQuizzes(): Promise<void> {
    this.quiz = generateQuiz('test-quiz');
    this.quiz.state = QuizState.Active;
    this.sandbox = sinon.createSandbox();
    this.sandbox.stub(QuizModel, 'find').value(() => (
      { exec: () => [this.quiz] }
    ));

    const quizze = await QuizDAO.getJoinableQuizzes();
    expect(quizze).to.include(this.quiz);

    this.sandbox.restore();
  }
}
