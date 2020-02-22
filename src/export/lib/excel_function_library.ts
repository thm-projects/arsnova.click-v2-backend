import MemberDAO from '../../db/MemberDAO';
import { IQuizBase } from '../../interfaces/quizzes/IQuizEntity';

export async function calculateNumberOfAnswers(quiz: IQuizBase, questionIndex: number, answerNumber: number): Promise<number> {
  let numberOfAnswers = 0;
  (await MemberDAO.getMembersOfQuizForOwner(quiz.name)).forEach(nickname => {
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

export async function calculateNumberOfRangedAnswers(
  quiz: IQuizBase,
  questionIndex: number,
  minRange,
  correctValue,
  maxRange,
): Promise<{ minRange: number, correctValue: number, maxRange: number }> {

  let numberOfAnswersInMinRange = 0;
  let numberOfAnswersInMaxRange = 0;
  let numberOfCorrectAnswers = 0;
  (await MemberDAO.getMembersOfQuizForOwner(quiz.name)).forEach((nickname) => {
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
