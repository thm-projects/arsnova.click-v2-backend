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

      if (action.request.headers.authorization.startsWith('Bearer ')) {
        action.request.headers.authorization = action.request.headers.authorization.replace('Bearer ', '');
      }

      const decodedToken = AuthService.decodeToken(action.request.headers.authorization);

      if (typeof decodedToken !== 'object' || !(decodedToken as any).name) {
        return false;
      }
      action.request.headers.authorization = (decodedToken as any).privateKey;

      return (searchRoles as unknown as Array<string>).some(role => (decodedToken as any).userAuthorizations.includes(UserRole[role]));
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
