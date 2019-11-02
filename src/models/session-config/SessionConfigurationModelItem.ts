import { prop } from '@typegoose/typegoose';
import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { ISessionConfigurationSerialized } from '../../interfaces/session_configuration/ISessionConfigurationSerialized';
import { MusicSessionConfigurationModelItem } from './MusicSessionConfigurationModelItem';
import { NickSessionConfigurationModelItem } from './NickSessionConfigurationModelItem';

export class SessionConfigurationModelItem implements ISessionConfigurationSerialized {
  @prop() public confidenceSliderEnabled: boolean;
  @prop() public music: MusicSessionConfigurationModelItem;
  @prop() public nicks: NickSessionConfigurationModelItem;
  @prop() public readingConfirmationEnabled: boolean;
  @prop() public showResponseProgress: boolean;
  @prop() public theme: string;
  @prop({ enum: LeaderboardConfiguration }) public leaderboardAlgorithm: LeaderboardConfiguration;
}
