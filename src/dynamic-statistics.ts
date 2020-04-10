import { freemem, loadavg, totalmem } from 'os';
import * as process from 'process';
import MemberDAO from './db/MemberDAO';
import QuizDAO from './db/QuizDAO';
import QuizPoolDAO from './db/QuizPoolDAO';

export const dynamicStatistics = async () => {
  const quizStatistics = await QuizDAO.getStatistics();
  const quizPoolStatistics = await QuizPoolDAO.getStatistics();
  const attendeeStatistics = await MemberDAO.getStatistics();

  return {
    uptime: process.uptime(),
    loadavg: loadavg(),
    freemem: freemem(),
    totalmem: totalmem(),
    quiz: {
      total: quizStatistics.total,
      active: quizStatistics.active,
      pool: quizPoolStatistics,
      participants: attendeeStatistics,
    },
    activeSockets: attendeeStatistics.total,
  };
};
