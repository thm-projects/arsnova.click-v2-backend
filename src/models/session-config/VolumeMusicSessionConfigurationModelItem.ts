import { prop, Typegoose } from 'typegoose';
import { IVolumeMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/IVolumeMusicSessionConfigurationSerialized';

export class VolumeMusicSessionConfigurationModelItem extends Typegoose implements IVolumeMusicSessionConfigurationSerialized {
  @prop() public countdownEnd: number;
  @prop() public countdownRunning: number;
  @prop() public global: number;
  @prop() public lobby: number;
  @prop() public useGlobalVolume: boolean;
}