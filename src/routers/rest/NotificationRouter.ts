import { Authorized, Body, HeaderParam, JsonController, Post } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { PushSubscription } from 'web-push';
import UserDAO from '../../db/UserDAO';
import { UserRole } from '../../enums/UserRole';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/notification')
export class NotificationRouter extends AbstractRouter {

  @Post('/') //
  @Authorized(UserRole.SuperAdmin) //
  @OpenAPI({
    description: 'Adds a push subscription',
    security: [{ bearerAuth: [] }],
  })
  private async getUsers(
    @HeaderParam('authorization', { required: false }) token: string, //
    @Body() sub: PushSubscription, //
  ): Promise<void> {
    const user = await UserDAO.getUserByToken(token);
    if (!user) {
      return;
    }

    await UserDAO.updateUser(user.id, { $push: { subscriptions: sub } });

    return;
  }
}
