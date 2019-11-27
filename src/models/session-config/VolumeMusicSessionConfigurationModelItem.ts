import { prop } from '@typegoose/typegoose';
import { IVolumeMusicSessionConfiguration } from '../../interfaces/session_configuration/music/IVolumeMusicSessionConfiguration';

export class VolumeMusicSessionConfigurationModelItem implements IVolumeMusicSessionConfiguration {
  @prop() public countdownEnd: number;
  @prop() public countdownRunning: number;
  @prop() public global: number;
  @prop() public lobby: number;
  @prop() public useGlobalVolume: boolean;
}
