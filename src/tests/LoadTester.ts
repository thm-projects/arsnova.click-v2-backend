import { EventEmitter } from 'events';
import MemberDAO from '../db/MemberDAO';
import QuizDAO from '../db/QuizDAO';
import { IQuiz } from '../interfaces/quizzes/IQuizEntity';
import { MemberModel } from '../models/member/MemberModel';
import LoggerService from '../services/LoggerService';
import { generateQuiz } from './fixtures';

export class LoadTester {
  private static readonly QUIZ_AMOUNT = 10;
  private static readonly ATTENDEE_AMOUNT_PER_QUIZ = 100;

  public done = new EventEmitter();
  private _quizzes: Array<string> = [];
  private readonly _questionLength = generateQuiz('').questionList.length;

  constructor() {
    this.loadQuizzes().then(() => this.addAttendees()).then(() => this.startQuizzes());
  }

  private startQuizzes(): void {
    LoggerService.debug(`[LoadTest ${process.pid}] Initializing quizzes`);
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      setTimeout(async () => {
        const name = this._quizzes[i];
        LoggerService.debug(`[LoadTest ${process.pid}] Selecting quiz '${name}'`);
        const quiz = await QuizDAO.getQuizByName(name);
        await QuizDAO.nextQuestion(quiz);

        for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
          setTimeout(async () => {
            LoggerService.debug(`[LoadTest ${process.pid}] Setting response for member 'attendee_${j}' in quiz '${name}'`);
            const member = await MemberModel.findOne({ currentQuizName: name, name: `attendee_${j}` });
            await MemberDAO.setReadingConfirmation(member);
            await MemberDAO.addResponseValue(member, [0]);
            await MemberDAO.setConfidenceValue(member, 100);

            if (j === LoadTester.ATTENDEE_AMOUNT_PER_QUIZ - 1) {
              LoggerService.debug(`[LoadTest ${process.pid}] done`);
              this.done.emit('done');
            }
          });
        }
      }, 0);
    }
  }

  private async addAttendees(): Promise<void> {
    LoggerService.debug(`[LoadTest ${process.pid}] Adding Attendees`);
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      const name = this._quizzes[i];
      for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
        await MemberDAO.addMember({
          name: `attendee_${j}`,
          groupName: 'Default',
          token: String(Math.random()),
          currentQuizName: name,
          responses: MemberDAO.generateResponseForQuiz(this._questionLength),
        });
      }
    }
    LoggerService.debug(`[LoadTest ${process.pid}] Attendees added`);
  }

  private async loadQuizzes(): Promise<void> {
    LoggerService.debug(`[LoadTest ${process.pid}] Initializing quizzes`);
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      const name = `loadquiz_${Math.random()}`;
      const quiz: IQuiz = generateQuiz(name);
      this._quizzes.push(name);
      const doc = await QuizDAO.addQuiz(quiz);
      await QuizDAO.initQuiz(doc);
    }
    LoggerService.debug(`[LoadTest ${process.pid}] Quizzes initialized`);
  }
}
