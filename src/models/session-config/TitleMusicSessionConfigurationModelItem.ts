import { prop } from '@typegoose/typegoose';
import { ITitleMusicSessionConfiguration } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfiguration';

export class TitleMusicSessionConfigurationModelItem implements ITitleMusicSessionConfiguration {
  @prop() public countdownEnd: string;
  @prop() public countdownRunning: string;
  @prop() public lobby: string;
}
