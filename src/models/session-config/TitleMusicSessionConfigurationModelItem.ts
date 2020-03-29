import { prop } from '@typegoose/typegoose';
import { IsString } from 'class-validator';
import { ITitleMusicSessionConfiguration } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfiguration';

export class TitleMusicSessionConfigurationModelItem implements ITitleMusicSessionConfiguration {
  @prop() @IsString() public countdownEnd: string;
  @prop() @IsString() public countdownRunning: string;
  @prop() @IsString() public lobby: string;
}
