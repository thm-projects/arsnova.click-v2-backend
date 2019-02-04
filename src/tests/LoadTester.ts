import MemberDAO from '../db/MemberDAO';
import QuizDAO from '../db/quiz/QuizDAO';
import { DefaultAnswerEntity } from '../entities/answer/DefaultAnswerEntity';
import { SingleChoiceQuestionEntity } from '../entities/question/SingleChoiceQuestionEntity';
import { QuizEntity } from '../entities/quiz/QuizEntity';
import { SessionConfigurationEntity } from '../entities/session-configuration/SessionConfigurationEntity';
import { LeaderboardConfiguration } from '../enums/LeaderboardConfiguration';

export class LoadTester {
  private static readonly QUIZ_AMOUNT = 1000;
  private static readonly ATTENDEE_AMOUNT_PER_QUIZ = 100;

  public done = false;

  constructor() {
    this.loadQuizzes();
    this.addAttendees();
    this.startQuizzes();
  }

  private startQuizzes(): void {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      setTimeout(() => {
        const quiz = QuizDAO.getQuizByName(`loadquiz_${i}`);
        quiz.nextQuestion();

        for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
          setTimeout(() => {
            MemberDAO.getMemberByName(`attendee_${j}`).setReadingConfirmation();
            MemberDAO.getMemberByName(`attendee_${j}`).addResponseValue([0]);
            MemberDAO.getMemberByName(`attendee_${j}`).setConfidenceValue(100);

            if (j === LoadTester.ATTENDEE_AMOUNT_PER_QUIZ - 1) {
              this.done = true;
            }
          }, 0);
        }
      }, 0);
    }
  }

  private addAttendees(): void {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      const quiz = QuizDAO.getQuizByName(`loadquiz_${i}`);
      for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
        MemberDAO.addMember({
          name: `attendee_${j}`,
          groupName: 'Default',
          token: 'token',
          currentQuizName: quiz.name,
        });
      }
    }
  }

  private loadQuizzes(): void {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      const quiz = new QuizEntity({
        name: `loadquiz_${i}`,
        readingConfirmationRequested: false,
        memberGroups: [{ name: 'Default' }],
        adminToken: 'test',
        privateKey: 'test',
        sessionConfig: new SessionConfigurationEntity({
          leaderboardAlgorithm: LeaderboardConfiguration.TimeBased,
          music: {
            enabled: {
              lobby: true,
              countdownRunning: true,
              countdownEnd: true,
            },
            volumeConfig: {
              global: 60,
              lobby: 60,
              countdownRunning: 60,
              countdownEnd: 60,
              useGlobalVolume: true,
            },
            titleConfig: {
              lobby: 'Song0',
              countdownRunning: 'Song0',
              countdownEnd: 'Song0',
            },
          },
          nicks: {
            memberGroups: ['Default'],
            maxMembersPerGroup: 10,
            autoJoinToGroup: false,
            blockIllegalNicks: true,
            restrictToCasLogin: false,
            selectedNicks: [],
          },
          theme: 'theme-Material',
          readingConfirmationEnabled: true,
          showResponseProgress: true,
          confidenceSliderEnabled: true,
        }),
        questionList: [
          new SingleChoiceQuestionEntity({
            answerOptionList: [
              new DefaultAnswerEntity({
                answerText: 'answer1',
                isCorrect: true,
              }), new DefaultAnswerEntity({
                answerText: 'answer2',
                isCorrect: false,
              }),
            ],
          }),
        ],
      });
      QuizDAO.initQuiz(quiz);
    }
  }
}
