import * as jwt from 'jsonwebtoken';
import { UnauthorizedError } from 'routing-controllers';
import UserDAO from '../db/UserDAO';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { UserRole } from '../enums/UserRole';
import { IUserEntity } from '../interfaces/users/IUserEntity';
import { staticStatistics } from '../statistics';

export class AuthService {

  public static authenticate({ username, password, searchRoles }: { username: any; password: any; searchRoles: UserRole[] }): boolean {
    const user = UserDAO.getUser(username);
    if (!user || !UserDAO.validateUser(username, password)) {
      throw new UnauthorizedError(JSON.stringify({
        status: StatusProtocol.Failed,
        message: MessageProtocol.NotAuthorized,
      }));
    }
    const token = UserDAO.getUser(username).token;
    if (!token || !UserDAO.validateTokenForUser(username, token)) {
      throw new UnauthorizedError(JSON.stringify({
        status: StatusProtocol.Failed,
        message: MessageProtocol.NotAuthorized,
      }));
    }

    const hasRoles = (searchRoles as unknown as Array<UserRole>).some(role => user.userAuthorizations.includes(role));
    if (!hasRoles) {
      throw new UnauthorizedError(`Only user with ${searchRoles.join(' &')} roles in the ldap user can pass.`);
    }

    return true;
  }

  public static createToken(payload): string {
    return jwt.sign(payload, staticStatistics.jwtSecret, {
      algorithm: 'HS512',
      expiresIn: 28800, // 8 hours
    });
  }

  public static generateToken(user: IUserEntity): string {
    const availableRoles: Array<string> = [];
    Object.keys(UserRole).forEach(role => {
      if (user.userAuthorizations.includes(UserRole[role])) {
        availableRoles.push(role);
      }
    });

    const gitlabToken = user.gitlabToken;

    return this.createToken({
      name: user.name,
      userAuthorizations: availableRoles,
      privateKey: user.privateKey,
      gitlabToken,
    });
  }

  public static decodeToken(token: string): string | object {
    return jwt.verify(token, staticStatistics.jwtSecret, {
      algorithms: ['HS512'],
    });
  }
}
