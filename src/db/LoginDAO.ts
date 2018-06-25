import { ILogin, ILoginSerialized } from 'arsnova-click-v2-types/src/common';
import { AbstractDAO } from './AbstractDAO';
import { DatabaseTypes, default as DbDAO } from './DbDAO';

class Login implements ILogin {
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

  constructor(username: string, passwordHash: string) {
    this._username = username;
    this._passwordHash = passwordHash;
  }

  public serialize(): ILoginSerialized {
    return {
      username: this.username,
      passwordHash: this.passwordHash,
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

  public initUser(username: string, passwordHash: string): void {
    if (typeof this.storage[username] !== 'undefined') {
      throw new Error(`Trying to initiate a duplicate login`);
    }

    this.storage[username] = new Login(username, passwordHash);
  }

  public validateUser(username: string, passwordHash: string): boolean {
    if (this.isEmptyVars([username, passwordHash, this.storage[username]])) {
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
    if (this.isEmptyVars([username, token, this.storage[username]])) {
      return false;
    }

    return this.storage[username].token === token;
  }
}

Object.keys(DbDAO.getState()[DatabaseTypes.users]).forEach((value: string) => {
  const loginData: ILoginSerialized = DbDAO.getState()[DatabaseTypes.users][value];
  LoginDAO.getInstance().initUser(loginData.username, loginData.passwordHash);
});

export default LoginDAO.getInstance();
