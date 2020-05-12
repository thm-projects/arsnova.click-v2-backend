export interface IUserBase {
  name: string;
  passwordHash: string;
  privateKey: string;
  tokenHash?: string;
  token?: string;
  gitlabToken?: string;
}
