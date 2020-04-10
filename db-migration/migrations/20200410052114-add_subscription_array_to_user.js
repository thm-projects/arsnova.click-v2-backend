module.exports = {
  async up(db, client) {
    const data = await db.collection('users').find({subscriptions: null}).toArray();
    await Promise.all(data.map(async elem => {
      await db.collection('users').updateOne({_id: elem._id}, {$set: {subscriptions: []}});
    }));
  },

  async down(db, client) {
    await db.collection('users').updateMany({}, {$unset: {subscriptions: ''}});
  }
};
