import * as routeCache from 'route-cache';
import { Get, JsonController, UseBefore } from 'routing-controllers';
import availableNicks from '../../lib/nicknames/availableNicks';
import illegalNicks from '../../lib/nicknames/illegalNicks';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/nicks')
export class NicksRouter extends AbstractRouter {

  @Get('/predefined')
  @UseBefore(routeCache.cacheSeconds(300))
  private getAllAvailableNicks(): object {
    return availableNicks;
  }

  @Get('/blocked')
  @UseBefore(routeCache.cacheSeconds(300))
  private getAllBlockedNicks(): object {
    return illegalNicks;
  }
}
