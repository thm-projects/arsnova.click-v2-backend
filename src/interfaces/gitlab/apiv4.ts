export interface ICommitAction {
  CREATE?: 'create';
  DELETE?: 'delete';
  MOVE?: 'move';
  UPDATE?: 'update';
}

export interface IGitlabCommitAction {
  action: ICommitAction;
  file_path: string;
  previous_path?: string;
  content?: string;
  encoding?: string;
  last_commit_id?: string;
}
