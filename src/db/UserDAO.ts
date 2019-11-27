import { ObjectId } from 'bson';
import { DeleteWriteOpResultObject } from 'mongodb';
import { Document } from 'mongoose';
import { UserRole } from '../enums/UserRole';
import { IUserSerialized } from '../interfaces/users/IUserSerialized';
import { UserModel, UserModelItem } from '../models/UserModelItem/UserModel';
import { AuthService } from '../services/AuthService';
import { AbstractDAO } from './AbstractDAO';

class UserDAO extends AbstractDAO {

  public static getInstance(): UserDAO {
    if (typeof this.instance === 'undefined') {
      this.instance = new UserDAO();
    }
    return this.instance;
  }

  public async initUser(user: IUserSerialized): Promise<Document & UserModelItem> {
    if (await UserModel.findOne({ name: user.name }).exec()) {
      throw new Error(`Trying to initiate a duplicate login`);
    }

    return UserModel.create(user);
  }

  public validateUser(name: string, passwordHash: string): Promise<boolean> {
    return UserModel.exists({
      name,
      passwordHash,
    });
  }

  public setTokenForUser(name: string, token: string): Promise<Document & UserModelItem> {
    return UserModel.updateOne({ name }, { token }).exec();
  }

  public validateTokenForUser(name: string, token: string): Promise<boolean> {
    return UserModel.exists({
      name,
      token,
      $where: function (): boolean {
        const decodedToken = AuthService.decodeToken(token);

        if (typeof decodedToken !== 'object' || !(decodedToken as any).name) {
          return false;
        }

        return (decodedToken as any).name === name;
      },
    });
  }

  public async getGitlabTokenForUser(name: string): Promise<string> {
    return (await UserModel.findOne({ name }).exec()).gitlabToken;
  }

  public isUserAuthorizedFor(name: string, userAuthorization: UserRole): Promise<boolean> {
    return UserModel.exists({
      name,
      userAuthorizations: { $all: userAuthorization },
    });
  }

  public getUser(name: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ name }).exec();
  }

  public getUserByTokenHash(tokenHash: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ tokenHash }).exec();
  }

  public getUserById(id: ObjectId): Promise<Document & UserModelItem> {
    return UserModel.findOne({ _id: id }).exec();
  }

  public clearStorage(): Promise<DeleteWriteOpResultObject['result'] & { deletedCount?: number }> {
    return UserModel.deleteMany({}).exec();
  }

  public removeUser(id: ObjectId): Promise<DeleteWriteOpResultObject['result'] & { deletedCount?: number }> {
    return UserModel.deleteOne({ _id: id }).exec();
  }

  public addUser(user: IUserSerialized): Promise<Document & UserModelItem> {
    return UserModel.create(user);
  }

  public updateUser(id: ObjectId, changedFields: object): Promise<Document & UserModelItem> {
    return UserModel.updateOne({ _id: new ObjectId(id) }, changedFields).exec();
  }

  public getUserByToken(token: string): Promise<Document & UserModelItem> {
    return UserModel.findOne({ token }).exec();
  }
}

export default UserDAO.getInstance();
