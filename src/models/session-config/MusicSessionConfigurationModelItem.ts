import { prop } from '@typegoose/typegoose';
import { IsObject } from 'class-validator';
import { IMusicSessionConfiguration } from '../../interfaces/session_configuration/music/IMusicSessionConfiguration';
import { TitleMusicSessionConfigurationModelItem } from './TitleMusicSessionConfigurationModelItem';
import { VolumeMusicSessionConfigurationModelItem } from './VolumeMusicSessionConfigurationModelItem';

export class MusicSessionConfigurationModelItem implements IMusicSessionConfiguration {
  @prop() @IsObject() public enabled: { lobby: boolean; countdownRunning: boolean; countdownEnd: boolean };
  @prop({ _id: false }) @IsObject() public titleConfig: TitleMusicSessionConfigurationModelItem;
  @prop({ _id: false }) @IsObject() public volumeConfig: VolumeMusicSessionConfigurationModelItem;
}
