export interface IUserBase {
  name: string;
  passwordHash: string;
  tokenHash: string;
  privateKey: string;
  token?: string;
  gitlabToken?: string;
}
