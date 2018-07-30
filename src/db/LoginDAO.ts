import { ILogin, ILoginSerialized } from 'arsnova-click-v2-types/src/common';
import * as jwt from 'jsonwebtoken';
import { DATABASE_TYPE, USER_AUTHORIZATION } from '../Enums';
import { staticStatistics } from '../statistics';
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

  get userAuthorizations(): Array<USER_AUTHORIZATION> {
    return this._userAuthorizations;
  }

  private readonly _username: string;
  private readonly _passwordHash: string;
  private readonly _gitlabToken: string;
  private readonly _userAuthorizations: Array<USER_AUTHORIZATION>;

  constructor({ username, passwordHash, gitlabToken, userAuthorizations }: ILoginSerialized) {
    this._username = username;
    this._passwordHash = passwordHash;
    this._gitlabToken = gitlabToken;
    this._userAuthorizations = userAuthorizations;

  }

  public generateToken(): string {
    return jwt.sign({
      username: this._username,
      userAuthorizations: this._userAuthorizations,
    }, staticStatistics.jwtSecret, {
      algorithm: 'HS512',
      expiresIn: 28800, // 8 hours
    });
  }

  public serialize(): ILoginSerialized {
    return {
      username: this.username,
      passwordHash: this.passwordHash,
      gitlabToken: this.gitlabToken,
      userAuthorizations: this.userAuthorizations,
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

  public initUser({ username, passwordHash, gitlabToken, userAuthorizations }: ILoginSerialized): void {
    if (typeof this.storage[username] !== 'undefined') {
      throw new Error(`Trying to initiate a duplicate login`);
    }

    this.storage[username] = new Login({
      username,
      passwordHash,
      gitlabToken,
      userAuthorizations,
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

    if (this.storage[username].token !== token) {
      return false;
    }

    try {
      jwt.verify(token, staticStatistics.jwtSecret);
      return true;
    } catch (ex) {
      console.log(ex);
      return false;
    }
  }

  public getGitlabTokenForUser(username: string, token: string): string {
    if (this.isEmptyVars(username, token, this.storage[username])) {
      return null;
    }

    return this.storage[username].gitlabToken;
  }

  public isUserAuthorizedFor(username: string, userAuthorization: USER_AUTHORIZATION): boolean {
    if (this.isEmptyVars(username, userAuthorization, this.storage[username])) {
      return null;
    }

    return this.storage[username].userAuthorizations.includes(userAuthorization);
  }

  public getUser(username: string): ILogin {
    if (this.isEmptyVars(username, this.storage[username])) {
      return null;
    }

    return this.storage[username];
  }
}

Object.keys(DbDAO.getState()[DATABASE_TYPE.USERS]).forEach((value: string) => {
  const loginData: ILoginSerialized = DbDAO.getState()[DATABASE_TYPE.USERS][value];
  LoginDAO.getInstance().initUser(loginData);
});

export default LoginDAO.getInstance();
