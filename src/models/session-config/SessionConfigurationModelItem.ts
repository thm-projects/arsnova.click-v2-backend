import { prop } from '@typegoose/typegoose';
import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { ISessionConfiguration } from '../../interfaces/session_configuration/ISessionConfiguration';
import { MusicSessionConfigurationModelItem } from './MusicSessionConfigurationModelItem';
import { NickSessionConfigurationModelItem } from './NickSessionConfigurationModelItem';

export class SessionConfigurationModelItem implements ISessionConfiguration {
  @prop() public confidenceSliderEnabled: boolean;
  @prop({ _id: false }) public music: MusicSessionConfigurationModelItem;
  @prop({ _id: false }) public nicks: NickSessionConfigurationModelItem;
  @prop() public readingConfirmationEnabled: boolean;
  @prop() public showResponseProgress: boolean;
  @prop() public theme: string;
  @prop({ enum: LeaderboardConfiguration }) public leaderboardAlgorithm: LeaderboardConfiguration;
}
