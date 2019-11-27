import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { IMusicSessionConfiguration } from './music/IMusicSessionConfiguration';
import { INickSessionConfiguration } from './nicks/INickSessionConfiguration';

export interface ISessionConfiguration {
  music: IMusicSessionConfiguration;
  nicks: INickSessionConfiguration;
  theme: string;
  readingConfirmationEnabled: boolean;
  showResponseProgress: boolean;
  confidenceSliderEnabled: boolean;
  leaderboardAlgorithm: LeaderboardConfiguration;
}
