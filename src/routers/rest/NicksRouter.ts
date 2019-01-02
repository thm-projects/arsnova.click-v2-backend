import { Get, JsonController } from 'routing-controllers';
import availableNicks from '../../lib/nicknames/availableNicks';
import illegalNicks from '../../lib/nicknames/illegalNicks';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/nicks')
export class NicksRouter extends AbstractRouter {

  @Get('/')
  private getAll(): object {
    return {};
  }

  @Get('/predefined')
  private getAllAvailableNicks(): object {
    return availableNicks;
  }

  @Get('/blocked')
  private getAllBlockedNicks(): object {
    return illegalNicks;
  }
}
