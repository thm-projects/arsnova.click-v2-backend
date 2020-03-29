import { prop } from '@typegoose/typegoose';
import { IsBoolean, IsNumber } from 'class-validator';
import { IVolumeMusicSessionConfiguration } from '../../interfaces/session_configuration/music/IVolumeMusicSessionConfiguration';

export class VolumeMusicSessionConfigurationModelItem implements IVolumeMusicSessionConfiguration {
  @prop() @IsNumber() public countdownEnd: number;
  @prop() @IsNumber() public countdownRunning: number;
  @prop() @IsNumber() public global: number;
  @prop() @IsNumber() public lobby: number;
  @prop() @IsBoolean() public useGlobalVolume: boolean;
}
