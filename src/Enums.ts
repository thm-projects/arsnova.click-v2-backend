export enum DATABASE_TYPE {
  QUIZ   = 'quiz', //
  ASSETS = 'assets', //
  USERS  = 'users', //
}

export enum GITLAB {
  PROJECT_ID    = 3909, //
  TARGET_BRANCH = 'master', //
}

export enum COMMIT_ACTION {
  CREATE = 'create', //
  DELETE = 'delete', //
  MOVE   = 'move', //
  UPDATE = 'update', //
}

export enum LANGUAGES {
  DE = 'de', //
  EN = 'en', //
  FR = 'fr', //
  ES = 'es', //
  IT = 'it', //
}

export enum USER_AUTHORIZATION {
  CREATE_EXPIRED_QUIZ = 'CREATE_EXPIRED_QUIZ', //
  CREATE_QUIZ_FROM_EXPIRED = 'CREATE_QUIZ_FROM_EXPIRED', //
  CREATE_QUIZ = 'CREATE_QUIZ', //
  EDIT_I18N = 'EDIT_I18N', //
}
