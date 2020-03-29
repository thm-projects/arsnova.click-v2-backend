export enum DbOperation {
  Read       = 'read', //
  Insert     = 'insert', //
  Create     = 'create', //
  Update     = 'update', //
  Delete     = 'delete', //
  DeleteOne  = 'deleteOne', //
  DeleteMany = 'deleteMany', //
  Share      = 'share', //
}

export enum DbWatchStreamOperation {
  Insert       = 'insert', // A new document is inserted
  Update       = 'update', // An existing document's property is updated
  Invalidate   = 'invalidate', // The change stream is dropped (caused by Drop event)
  Delete       = 'delete', // A document is deleted
  Replace      = 'replace', // One document is replaced with another with the same ObjectId
  Drop         = 'drop', // Collection is dropped
  Rename       = 'rename', // Collection is renamed
  DropDatabase = 'dropDatabase', // Database is dropped
}

export enum Database {
  Default = <any>`${process.env.MONGODB_DATABASE || 'arsnova-click-v2'}`, //
}

export enum DbCollection {
  QuizPool   = 'quizpool', //
  Quizzes    = 'quizzes', //
  Users      = 'users', //
  Assets     = 'assets', //
  CasTickets = 'casTickets', //
  Members    = 'members', //
}

export enum DbEvent {
  SessionConfigChanged = 'sessionConfigChanged', //
  StateChanged         = 'stateChanged', //
  Connected            = 'connected', //
  Change               = 'change', //
  Initialized          = 'initialized', //
  Create               = 'create', //
  Delete               = 'delete', //
}
