import MemberDAO from '../../db/MemberDAO';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';

export function calculateNumberOfAnswers(quiz: IQuizEntity, questionIndex: number, answerNumber: number): number {
  let numberOfAnswers = 0;
  MemberDAO.getMembersOfQuiz(quiz.name).forEach(nickname => {
    const response = nickname.responses[questionIndex].value;
    // noinspection SuspiciousInstanceOfGuard
    if (Array.isArray(response)) {
      numberOfAnswers += response.indexOf(answerNumber) > -1 ? 1 : 0;
    } else if (typeof response === 'number') {
      numberOfAnswers += response;
    }
  });
  return numberOfAnswers;
}

export function calculateNumberOfRangedAnswers(
  quiz: IQuizEntity,
  questionIndex: number,
  minRange,
  correctValue,
  maxRange,
): { minRange: number, correctValue: number, maxRange: number } {

  let numberOfAnswersInMinRange = 0;
  let numberOfAnswersInMaxRange = 0;
  let numberOfCorrectAnswers = 0;
  MemberDAO.getMembersOfQuiz(quiz.name).forEach((nickname) => {
    if (nickname.responses[questionIndex].value <= maxRange && nickname.responses[questionIndex].value > correctValue) {
      numberOfAnswersInMaxRange++;
    } else if (nickname.responses[questionIndex].value === correctValue) {
      numberOfCorrectAnswers++;
    } else if (nickname.responses[questionIndex].value >= minRange) {
      numberOfAnswersInMinRange++;
    }
  });
  return {
    minRange: numberOfAnswersInMinRange,
    correctValue: numberOfCorrectAnswers,
    maxRange: numberOfAnswersInMaxRange,
  };
}
