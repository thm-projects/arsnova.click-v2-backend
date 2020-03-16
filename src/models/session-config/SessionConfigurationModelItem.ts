import { prop } from '@typegoose/typegoose';
import { IsBoolean, IsEnum, IsObject, IsString } from 'class-validator';
import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { ISessionConfiguration } from '../../interfaces/session_configuration/ISessionConfiguration';
import { MusicSessionConfigurationModelItem } from './MusicSessionConfigurationModelItem';
import { NickSessionConfigurationModelItem } from './NickSessionConfigurationModelItem';

export class SessionConfigurationModelItem implements ISessionConfiguration {
  @prop() @IsBoolean() public confidenceSliderEnabled: boolean;
  @prop({ _id: false }) @IsObject() public music: MusicSessionConfigurationModelItem;
  @prop({ _id: false }) @IsObject() public nicks: NickSessionConfigurationModelItem;
  @prop() @IsBoolean() public readingConfirmationEnabled: boolean;
  @prop() @IsBoolean() public showResponseProgress: boolean;
  @prop() @IsString() public theme: string;
  @prop({ enum: LeaderboardConfiguration }) @IsEnum(LeaderboardConfiguration) public leaderboardAlgorithm: LeaderboardConfiguration;
}
