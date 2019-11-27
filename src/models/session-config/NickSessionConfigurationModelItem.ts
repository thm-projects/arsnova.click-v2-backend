import { prop } from '@typegoose/typegoose';
import { INickSessionConfiguration } from '../../interfaces/session_configuration/nicks/INickSessionConfiguration';

export class NickSessionConfigurationModelItem implements INickSessionConfiguration {
  @prop() public autoJoinToGroup: boolean;
  @prop() public blockIllegalNicks: boolean;
  @prop() public maxMembersPerGroup: number;
  @prop() public memberGroups: Array<string>;
  @prop() public restrictToCasLogin: boolean;
  @prop() public selectedNicks: Array<string>;
}
