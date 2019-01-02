import { ObjectId } from 'bson';
import { UserEntity } from '../entities/UserEntity';
import { DbCollection, DbEvent } from '../enums/DbOperation';
import { UserRole } from '../enums/UserRole';
import { IUserEntity } from '../interfaces/users/IUserEntity';
import { IUserSerialized } from '../interfaces/users/IUserSerialized';
import LoggerService from '../services/LoggerService';
import { AbstractDAO } from './AbstractDAO';
import { default as DbDAO } from './DbDAO';

class UserDAO extends AbstractDAO<{ [key: string]: IUserEntity }> {

  constructor() {
    super({});

    DbDAO.isDbAvailable.on(DbEvent.Connected, isConnected => {
      if (isConnected) {
        const cursor = DbDAO.readMany(DbCollection.Users, {});
        cursor.forEach(doc => {
          this.initUser(doc);
        });
      }
    });
  }

  public static getInstance(): UserDAO {
    if (typeof this.instance === 'undefined') {
      this.instance = new UserDAO();
    }
    return this.instance;
  }

  public initUser(user: IUserSerialized): void {
    if (typeof this.storage[user.name] !== 'undefined') {
      throw new Error(`Trying to initiate a duplicate login`);
    }

    this.storage[user.name] = new UserEntity(user);
  }

  public validateUser(name: string, passwordHash: string): boolean {
    if (this.isEmptyVars(name, passwordHash, this.storage[name])) {
      return false;
    }

    return this.storage[name].passwordHash === passwordHash;
  }

  public createDump(): Array<IUserSerialized> {
    return Object.keys(this.storage).map(name => {
      return this.storage[name].serialize();
    });
  }

  public setTokenForUser(name: string, token: string): void {
    this.storage[name].token = token;
  }

  public validateTokenForUser(name: string, token: string): boolean {
    if (this.isEmptyVars(name, token, this.storage[name])) {
      return false;
    }

    try {
      this.storage[name].validateToken(token);
      return true;
    } catch (ex) {
      LoggerService.error(ex.message);
      return false;
    }
  }

  public getGitlabTokenForUser(name: string, token: string): string {
    if (this.isEmptyVars(name, token, this.storage[name])) {
      return null;
    }

    return this.storage[name].gitlabToken;
  }

  public isUserAuthorizedFor(name: string, userAuthorization: UserRole): boolean {
    if (this.isEmptyVars(name, userAuthorization, this.storage[name])) {
      return null;
    }

    return this.storage[name].userAuthorizations.includes(userAuthorization);
  }

  public getUser(name: string): IUserEntity {
    if (this.isEmptyVars(name, this.storage[name])) {
      return null;
    }

    return this.storage[name];
  }

  public getUserById(id: ObjectId): IUserEntity {
    return Object.values(this.storage).find(val => val.id.equals(id));
  }

  public clearStorage(): void {
    Object.keys(this.storage).forEach(name => delete this.storage[name]);
  }

  public removeUser(id: ObjectId): void {
    delete this.storage[Object.values(this.storage).find(val => val.id.equals(id)).name];
  }

  public addUser(user: IUserSerialized): void {
    this.storage[user.name] = new UserEntity(user);
  }

  public updateUser(id: ObjectId, changedFields: IUserSerialized): void {
    const originalUser = this.getUserById(id);
    if (!originalUser) {
      return;
    }
    const userEntity = new UserEntity(Object.assign({}, originalUser.serialize(), changedFields));

    if (changedFields.name && originalUser.name !== changedFields.name) {
      this.storage[changedFields.name] = userEntity;
      delete this.storage[originalUser.name];
    } else {
      this.storage[originalUser.name] = userEntity;
    }
  }

  public getUserByToken(token: string): IUserEntity {
    return Object.values(this.storage).find(val => val.token === token);
  }
}

export default UserDAO.getInstance();
