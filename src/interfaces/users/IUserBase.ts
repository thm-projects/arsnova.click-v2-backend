export interface IUserBase {
  name: string;
  passwordHash: string;
  privateKey: string;
  token?: string;
  gitlabToken?: string;
}
