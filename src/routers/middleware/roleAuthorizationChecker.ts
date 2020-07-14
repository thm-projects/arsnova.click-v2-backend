import { Action } from 'routing-controllers';
import { UserRole } from '../../enums/UserRole';
import { AuthService } from '../../services/AuthService';

export async function roleAuthorizationChecker(action: Action, searchRoles: UserRole[]): Promise<boolean> {
  try {
    let username;
    let password;

    if (action.request.body && action.request.body.username && action.request.body.password) {
      username = action.request.body.username;
      password = action.request.body.password;
    }

    if (action.request.headers && !username || !password && !username.length || !password.length) {
      if (!action.request.headers.authorization) {
        return false;
      }

      if (action.request.headers.authorization.startsWith('Basic ')) {
        const encBasicAuth = (action.request.headers.authorization || '').replace('Basic ', '');
        const decBasicAuth = Buffer.from(encBasicAuth, 'base64').toString().split(':');

        if (!decBasicAuth || decBasicAuth.length !== 2) {
          return false;
        }

        username = decBasicAuth[0];
        password = decBasicAuth[1];
      } else if (action.request.headers.authorization.startsWith('Bearer ')) {
        const token = action.request.headers.authorization.replace('Bearer ', '');
        const decodedToken = AuthService.decodeToken(token);

        if (typeof decodedToken !== 'object' || !(decodedToken as any).name) {
          return false;
        }

        return (searchRoles as unknown as Array<string>).some(role => (decodedToken as any).userAuthorizations.includes(UserRole[role]));
      }

      return false;
    }

    const authenticated = await AuthService.authenticate({
      username,
      password,
      searchRoles,
    });

    return !!authenticated;

  } catch (e) {
    return false;
  }
}
