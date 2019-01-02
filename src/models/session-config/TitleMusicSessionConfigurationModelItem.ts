import { prop, Typegoose } from 'typegoose';
import { ITitleMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfigurationSerialized';

export class TitleMusicSessionConfigurationModelItem extends Typegoose implements ITitleMusicSessionConfigurationSerialized {
  @prop() public countdownEnd: string;
  @prop() public countdownRunning: string;
  @prop() public lobby: string;
}
