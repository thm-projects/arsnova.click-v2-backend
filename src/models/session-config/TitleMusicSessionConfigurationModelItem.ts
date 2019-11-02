import { prop } from '@typegoose/typegoose';
import { ITitleMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfigurationSerialized';

export class TitleMusicSessionConfigurationModelItem implements ITitleMusicSessionConfigurationSerialized {
  @prop() public countdownEnd: string;
  @prop() public countdownRunning: string;
  @prop() public lobby: string;
}
