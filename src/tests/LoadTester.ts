import { DefaultAnswerOption } from 'arsnova-click-v2-types/src/answeroptions/answeroption_default';
import { SingleChoiceQuestion } from 'arsnova-click-v2-types/src/questions/question_choice_single';
import { DefaultQuestionGroup } from 'arsnova-click-v2-types/src/questions/questiongroup_default';
import { SessionConfiguration } from 'arsnova-click-v2-types/src/session_configuration/session_config';
import QuizManagerDAO from '../db/QuizManagerDAO';

export class LoadTester {
  private static readonly QUIZ_AMOUNT = 100;
  private static readonly ATTENDEE_AMOUNT_PER_QUIZ = 200;

  public done = false;

  constructor() {
    this.loadQuizzes();
    this.addAttendees();
    this.startQuizzes();
  }

  private startQuizzes(): void {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      setTimeout(() => {
        const quiz = QuizManagerDAO.getActiveQuizByName(`loadquiz_${i}`);
        quiz.nextQuestion();

        for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
          setTimeout(() => {
            quiz.setReadingConfirmation(`attendee_${j}`);
            quiz.addResponseValue(`attendee_${j}`, [0]);
            quiz.setConfidenceValue(`attendee_${j}`, 100);

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
      const quiz = QuizManagerDAO.getActiveQuizByName(`loadquiz_${i}`);
      for (let j = 0; j < LoadTester.ATTENDEE_AMOUNT_PER_QUIZ; j++) {
        quiz.addMember(`attendee_${j}`, 0, 'Default');
      }
    }
  }

  private loadQuizzes(): void {
    for (let i = 0; i < LoadTester.QUIZ_AMOUNT; i++) {
      QuizManagerDAO.initInactiveQuiz(`loadquiz_${i}`);
      const quiz = new DefaultQuestionGroup({
        hashtag: `loadquiz_${i}`,
        sessionConfig: new SessionConfiguration({
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
          new SingleChoiceQuestion({
            answerOptionList: [
              new DefaultAnswerOption({
                answerText: 'answer1',
                isCorrect: true,
              }), new DefaultAnswerOption({
                answerText: 'answer2',
                isCorrect: false,
              }),
            ],
          }),
        ],
      });
      QuizManagerDAO.initActiveQuiz(quiz);
    }
  }
}
