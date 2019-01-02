import { ObjectId } from 'bson';
import { UserRole } from '../enums/UserRole';
import { IUserEntity } from '../interfaces/users/IUserEntity';
import { IUserSerialized } from '../interfaces/users/IUserSerialized';
import { AuthService } from '../services/AuthService';
import { AbstractEntity } from './AbstractEntity';

export class UserEntity extends AbstractEntity implements IUserEntity {
  private _token: string;

  get token(): string {
    return this._token;
  }

  set token(value: string) {
    this._token = value;
  }

  private _userAuthorizations: Array<UserRole>;

  get userAuthorizations(): Array<UserRole> {
    return this._userAuthorizations;
  }

  set userAuthorizations(value: Array<UserRole>) {
    this._userAuthorizations = value;
  }

  private _name: string;

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  private _passwordHash: string;

  get passwordHash(): string {
    return this._passwordHash;
  }

  set passwordHash(value: string) {
    this._passwordHash = value;
  }

  private _gitlabToken: string;

  get gitlabToken(): string {
    return this._gitlabToken;
  }

  set gitlabToken(value: string) {
    this._gitlabToken = value;
  }

  constructor(data: IUserSerialized) {
    super();

    this._id = new ObjectId(data.id || data._id);
    this._name = data.name;
    this._passwordHash = data.passwordHash;
    this._gitlabToken = data.gitlabToken;
    this._token = data.token;
    this._userAuthorizations = data.userAuthorizations.map(val => UserRole[val]);
  }

  public validateToken(token: string): boolean {
    const decodedToken = AuthService.decodeToken(token);

    if (typeof decodedToken !== 'object' || !(decodedToken as any).name) {
      return false;
    }

    return (decodedToken as any).name === this.name;
  }

  public serialize(): IUserSerialized {
    return {
      id: this.id.toHexString(),
      token: this.token,
      name: this.name,
      passwordHash: this.passwordHash,
      gitlabToken: this.gitlabToken,
      userAuthorizations: this.userAuthorizations,
    };
  }
}
