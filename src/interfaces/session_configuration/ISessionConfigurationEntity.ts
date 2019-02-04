import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { ISessionConfigurationSerialized } from './ISessionConfigurationSerialized';
import { IMusicSessionConfigurationEntity } from './music/IMusicSessionConfigurationEntity';
import { INickSessionConfigurationEntity } from './nicks/INickSessionConfigurationEntity';

export interface ISessionConfigurationEntity extends ISessionConfigurationSerialized {
  music: IMusicSessionConfigurationEntity;
  nicks: INickSessionConfigurationEntity;
  leaderboardAlgorithm: LeaderboardConfiguration;

  serialize(): ISessionConfigurationSerialized;

  equals(value: ISessionConfigurationEntity): boolean;
}
