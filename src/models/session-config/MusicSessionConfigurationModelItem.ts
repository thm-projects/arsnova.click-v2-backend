import { prop } from '@typegoose/typegoose';
import { IMusicSessionConfiguration } from '../../interfaces/session_configuration/music/IMusicSessionConfiguration';
import { TitleMusicSessionConfigurationModelItem } from './TitleMusicSessionConfigurationModelItem';
import { VolumeMusicSessionConfigurationModelItem } from './VolumeMusicSessionConfigurationModelItem';

export class MusicSessionConfigurationModelItem implements IMusicSessionConfiguration {
  @prop() public enabled: { lobby: boolean; countdownRunning: boolean; countdownEnd: boolean };
  @prop({ _id: false }) public titleConfig: TitleMusicSessionConfigurationModelItem;
  @prop({ _id: false }) public volumeConfig: VolumeMusicSessionConfigurationModelItem;
}
