import { prop } from '@typegoose/typegoose';
import { IsArray, IsBoolean, IsNumber } from 'class-validator';
import { INickSessionConfiguration } from '../../interfaces/session_configuration/nicks/INickSessionConfiguration';
import { IMemberGroupBase } from '../../interfaces/users/IMemberGroupBase';

export class NickSessionConfigurationModelItem implements INickSessionConfiguration {
  @prop() @IsBoolean() public autoJoinToGroup: boolean;
  @prop() @IsBoolean() public blockIllegalNicks: boolean;
  @prop() @IsNumber() public maxMembersPerGroup: number;
  @prop() @IsArray() public memberGroups: Array<IMemberGroupBase>;
  @prop() @IsArray() public selectedNicks: Array<string>;
}
