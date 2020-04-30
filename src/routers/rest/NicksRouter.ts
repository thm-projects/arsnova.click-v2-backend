import * as routeCache from 'route-cache';
import { Get, JsonController, UseBefore } from 'routing-controllers';
import { RoutingCache } from '../../enums/RoutingCache';
import availableNicks from '../../lib/nicknames/availableNicks';
import illegalNicks from '../../lib/nicknames/illegalNicks';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/nicks')
export class NicksRouter extends AbstractRouter {

  @Get('/predefined')
  @UseBefore(routeCache.cacheSeconds(300, RoutingCache.PredefinedNicks))
  private getAllAvailableNicks(): object {
    return availableNicks;
  }

  @Get('/blocked')
  @UseBefore(routeCache.cacheSeconds(300, RoutingCache.BlockedNicks))
  private getAllBlockedNicks(): object {
    return illegalNicks;
  }
}
