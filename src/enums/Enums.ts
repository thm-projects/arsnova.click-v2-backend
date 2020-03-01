import { settings } from '../statistics';

export enum GitlabProject {
  'arsnova-click-v2-backend'  = settings.gitlab.backend, //
  'arsnova-click-v2-frontend' = settings.gitlab.frontend, //
}

export enum Branch {
  DefaultBranch = 'master', //
}

export enum GitlabCommitAction {
  Create = 'create', //
  Delete = 'delete', //
  Move   = 'move', //
  Update = 'update', //
}

export enum Language {
  De = 'de', //
  En = 'en', //
  Fr = 'fr', //
  Es = 'es', //
  It = 'it', //
}
