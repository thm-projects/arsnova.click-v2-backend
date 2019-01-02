import { ITitleMusicSessionConfigurationSerialized } from './ITitleMusicSessionConfigurationSerialized';
import { IVolumeMusicSessionConfigurationSerialized } from './IVolumeMusicSessionConfigurationSerialized';

export interface IMusicSessionConfigurationSerialized {
  enabled: {
    lobby: boolean; countdownRunning: boolean; countdownEnd: boolean;
  };
  volumeConfig: IVolumeMusicSessionConfigurationSerialized;
  titleConfig: ITitleMusicSessionConfigurationSerialized;
}
