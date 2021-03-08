import * as jwt from 'jsonwebtoken';
import { UnauthorizedError } from 'routing-controllers';
import UserDAO from '../db/UserDAO';
import { MessageProtocol, StatusProtocol } from '../enums/Message';
import { UserRole } from '../enums/UserRole';
import { UserModelItem } from '../models/UserModelItem/UserModel';
import { settings } from '../statistics';

export class AuthService {

  public static async authenticate({ username, password, searchRoles }: { username: any; password: any; searchRoles: UserRole[] }): Promise<boolean> {
    const user = await UserDAO.getUser(username);
    if (!user || !(await UserDAO.validateUser(username, password))) {
      throw new UnauthorizedError(JSON.stringify({
        status: StatusProtocol.Failed,
        message: MessageProtocol.NotAuthorized,
      }));
    }

    const token = (await UserDAO.getUser(username)).token;
    if (!token || !(await UserDAO.validateTokenForUser(username, token))) {
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
    return jwt.sign(payload, settings.jwtSecret, {
      algorithm: 'HS512',
      expiresIn: 28800, // 8 hours
    });
  }

  public static generateToken(user: UserModelItem): string {
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
    return jwt.verify(token, settings.jwtSecret, {
      algorithms: ['HS512'],
    });
  }

  public static decodeLoginToken(token: string): string {
    return token.match(/bearer /i) ? (this.decodeToken(token.substr(7)) as any).privateKey : null;
  }
}
