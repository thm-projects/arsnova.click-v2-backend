import { prop, Typegoose } from 'typegoose';
import { INickSessionConfigurationSerialized } from '../../interfaces/session_configuration/nicks/INickSessionConfigurationSerialized';

export class NickSessionConfigurationModelItem extends Typegoose implements INickSessionConfigurationSerialized {
  @prop() public autoJoinToGroup: boolean;
  @prop() public blockIllegalNicks: boolean;
  @prop() public maxMembersPerGroup: number;
  @prop() public memberGroups: Array<string>;
  @prop() public restrictToCasLogin: boolean;
  @prop() public selectedNicks: Array<string>;
}
