import MemberDAO from './db/MemberDAO';
import QuizDAO from './db/QuizDAO';
import QuizPoolDAO from './db/QuizPoolDAO';

export const dynamicStatistics = async () => {
  const quizStatistics = await QuizDAO.getStatistics();
  const quizPoolStatistics = await QuizPoolDAO.getStatistics();
  const attendeeStatistics = await MemberDAO.getStatistics();

  return {
    quiz: {
      total: quizStatistics.total,
      active: quizStatistics.active,
      pool: quizPoolStatistics,
      participants: attendeeStatistics,
    },
    activeSockets: attendeeStatistics.total,
  };
};
