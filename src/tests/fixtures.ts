import { AnswerType } from '../enums/AnswerType';
import { LeaderboardConfiguration } from '../enums/LeaderboardConfiguration';
import { QuestionType } from '../enums/QuestionType';
import { QuizState } from '../enums/QuizState';
import { IQuiz } from '../interfaces/quizzes/IQuizEntity';

export const generateQuiz = (name: string): IQuiz => {
  return {
    name,
    readingConfirmationRequested: false,
    privateKey: 'test',
    state: QuizState.Inactive,
    currentStartTimestamp: 0,
    currentQuestionIndex: -1,
    sessionConfig: {
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
    },
    questionList: [
      {
        TYPE: QuestionType.SingleChoiceQuestion,
        displayAnswerText: true,
        questionText: 'abc',
        timer: 60,
        answerOptionList: [
          {
            TYPE: AnswerType.DefaultAnswerOption,
            answerText: 'answer1',
            isCorrect: true,
          }, {
            TYPE: AnswerType.DefaultAnswerOption,
            answerText: 'answer2',
            isCorrect: false,
          },
        ],
      },
    ],
  };
};
