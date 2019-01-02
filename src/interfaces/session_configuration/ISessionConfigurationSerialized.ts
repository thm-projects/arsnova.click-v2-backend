import { IMusicSessionConfigurationSerialized } from './music/IMusicSessionConfigurationSerialized';
import { INickSessionConfigurationSerialized } from './nicks/INickSessionConfigurationSerialized';

export interface ISessionConfigurationSerialized {
  music: IMusicSessionConfigurationSerialized;
  nicks: INickSessionConfigurationSerialized;
  theme: string;
  readingConfirmationEnabled: boolean;
  showResponseProgress: boolean;
  confidenceSliderEnabled: boolean;
}
