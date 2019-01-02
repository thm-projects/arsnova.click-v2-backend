import { prop, Typegoose } from 'typegoose';
import { IMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/IMusicSessionConfigurationSerialized';
import { TitleMusicSessionConfigurationModelItem } from './TitleMusicSessionConfigurationModelItem';
import { VolumeMusicSessionConfigurationModelItem } from './VolumeMusicSessionConfigurationModelItem';

export class MusicSessionConfigurationModelItem extends Typegoose implements IMusicSessionConfigurationSerialized {
  @prop() public enabled: { lobby: boolean; countdownRunning: boolean; countdownEnd: boolean };
  @prop() public titleConfig: TitleMusicSessionConfigurationModelItem;
  @prop() public volumeConfig: VolumeMusicSessionConfigurationModelItem;
}
