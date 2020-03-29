const CryptoJS = require('crypto-js');

module.exports = {
  async up(db, client) {
    const data = await db.collection('quizpool').find({hash: null}).toArray();
    await Promise.all(data.map(async elem => {
      const hash = CryptoJS.SHA3(JSON.stringify(elem.question)).toString();
      const contentHash = {
        questionText: Buffer.from(elem.question.questionText).toString('base64'),
        answerOptionList: Buffer.from(JSON.stringify(elem.question.answerOptionList)).toString('base64'),
        tags: Buffer.from(elem.question.tags.sort().join()).toString('base64'),
      };
      await db.collection('quizpool').updateOne({_id: elem._id}, {$set: {hash, contentHash}});
    }));
    await db.collection('quizpool').createIndex('hash', {unique: true});
  },

  async down(db, client) {
    if (await db.collection('quizpool').indexExists('hash_1')) {
      await db.collection('quizpool').dropIndex('hash_1');
    }
    await db.collection('quizpool').updateMany({}, {$unset: {hash: '', contentHash: ''}});
  },
};
