const jwt = require('jsonwebtoken');

module.exports = {
  async up(db, client) {

    const quizzes = await db.collection('quizzes').find({privateKey: /bearer /i}).toArray();

    if (!quizzes.length) {
      return;
    }

    await Promise.all(quizzes.map(async quiz => {

      const privateKey = jwt.verify(
        quiz.privateKey.substr(7),
        'arsnova.click-v2', {
          algorithms: ['HS512'],
        }
      ).privateKey;

      await db.collection('quizzes').updateOne({_id: quiz._id}, {$set: {privateKey}});
    }));
  },

  async down(db, client) {
  }
};
