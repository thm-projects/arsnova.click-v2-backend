import { ILogin, ILoginSerialized } from 'arsnova-click-v2-types/src/common';
import { DATABASE_TYPE } from '../Enums';
import { AbstractDAO } from './AbstractDAO';
import { default as DbDAO } from './DbDAO';

class Login implements ILogin {
  get gitlabToken(): string {
    return this._gitlabToken;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get username(): string {
    return this._username;
  }

  private _token: string;

  get token(): string {
    return this._token;
  }

  set token(value: string) {
    this._token = value;
  }

  private readonly _username: string;
  private readonly _passwordHash: string;
  private readonly _gitlabToken: string;

  constructor({ username, passwordHash, gitlabToken }: ILoginSerialized) {
    this._username = username;
    this._passwordHash = passwordHash;
    this._gitlabToken = gitlabToken;
  }

  public serialize(): ILoginSerialized {
    return {
      username: this.username,
      passwordHash: this.passwordHash,
      gitlabToken: this.gitlabToken,
    };
  }
}

class LoginDAO extends AbstractDAO<{ [key: string]: ILogin }> {

  public static getInstance(): LoginDAO {
    if (typeof this.instance === 'undefined') {
      this.instance = new LoginDAO({});
    }
    return this.instance;
  }

  public initUser({ username, passwordHash, gitlabToken }: ILoginSerialized): void {
    if (typeof this.storage[username] !== 'undefined') {
      throw new Error(`Trying to initiate a duplicate login`);
    }

    this.storage[username] = new Login({
      username,
      passwordHash,
      gitlabToken,
    });
  }

  public validateUser(username: string, passwordHash: string): boolean {
    if (this.isEmptyVars(username, passwordHash, this.storage[username])) {
      return false;
    }

    return this.storage[username].passwordHash === passwordHash;
  }

  public createDump(): Array<ILoginSerialized> {
    return Object.keys(this.storage).map(username => {
      return this.storage[username].serialize();
    });
  }

  public setTokenForUser(username: string, token: string): void {
    this.storage[username].token = token;
  }

  public validateTokenForUser(username: string, token: string): boolean {
    if (this.isEmptyVars(username, token, this.storage[username])) {
      return false;
    }

    return this.storage[username].token === token;
  }

  public getGitlabTokenForUser(username: string, token: string): string {
    if (this.isEmptyVars(username, token, this.storage[username])) {
      return null;
    }

    return this.storage[username].gitlabToken;
  }
}

Object.keys(DbDAO.getState()[DATABASE_TYPE.USERS]).forEach((value: string) => {
  const loginData: ILoginSerialized = DbDAO.getState()[DATABASE_TYPE.USERS][value];
  LoginDAO.getInstance().initUser(loginData);
});

export default LoginDAO.getInstance();
