import { EventEmitter } from 'events';
import MemberDAO from '../db/MemberDAO';
import QuizDAO from '../db/quiz/QuizDAO';
import { IQuiz } from '../interfaces/quizzes/IQuizEntity';
import { generateQuiz } from './fixtures';

export class LoadTester {
  private static readonly QUIZ_AMOUNT = 1000;
  private static readonly ATTENDEE_AMOUNT_PER_QUIZ = 100;

  public done = new EventEmitter();

  constructor() {
    this.loadQuizzes().then(() => this.addAttendees()).then(() => this.startQuizzes());
  }

  private startQuizzes(): void {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      setTimeout(async () => {
        const quiz = await QuizDAO.getQuizByName(`loadquiz_${i}`);
        await QuizDAO.nextQuestion(quiz);

        for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
          setTimeout(async () => {
            const member = await MemberDAO.getMemberByName(`attendee_${j}`);
            await MemberDAO.setReadingConfirmation(member);
            await MemberDAO.addResponseValue(member, [0]);
            await MemberDAO.setConfidenceValue(member, 100);

            if (j === LoadTester.ATTENDEE_AMOUNT_PER_QUIZ - 1) {
              this.done.emit('done');
            }
          }, 0);
        }
      }, 0);
    }
  }

  private async addAttendees(): Promise<void> {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      const quiz = await QuizDAO.getQuizByName(`loadquiz_${i}`);
      for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
        await MemberDAO.addMember({
          name: `attendee_${j}`,
          groupName: 'Default',
          token: 'token',
          currentQuizName: quiz.name,
        });
      }
    }
  }

  private async loadQuizzes(): Promise<void> {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      const quiz: IQuiz = generateQuiz(`loadquiz_${i}`);
      const doc = await QuizDAO.addQuiz(quiz);
      await QuizDAO.initQuiz(doc);
    }
  }
}
