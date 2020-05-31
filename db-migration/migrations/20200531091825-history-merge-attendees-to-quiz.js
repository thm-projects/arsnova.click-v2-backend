module.exports = {
  async up(db, client) {

    const allDistinctQuizElements = await db.collection('history').aggregate([
      { $match: { type: 'PlayedQuiz', attendees: { $exists: false } }},
      { $group: { _id: '$name' } }
    ]).toArray();

    if (!allDistinctQuizElements.length) {
      return;
    }

    await Promise.all(allDistinctQuizElements.map(async historyQuiz => {
      const quizName = historyQuiz._id;
      const lastQuizElements = await db.collection('history').find({name: quizName}).sort({createdAt: -1}).limit(1).toArray();
      const lastQuizElement = lastQuizElements[0];
      const data = await db.collection('history').find({ref: quizName}).toArray();
      const names = data.map(v => v.name);

      await db.collection('history').updateOne({_id: lastQuizElement._id}, {$set: {attendees: names.filter((name, index) => names.indexOf(name) === index)}});
      await db.collection('history').deleteMany({ref: quizName});
      await db.collection('history').deleteMany({name: quizName, _id: { $ne: lastQuizElement._id }});
    }));

    await db.collection('history').deleteMany({attendees: { $size: 0 }});
  },

  async down(db, client) {
    await db.collection('history').updateMany({}, {$unset: {attendees: ''}});
  }
};
