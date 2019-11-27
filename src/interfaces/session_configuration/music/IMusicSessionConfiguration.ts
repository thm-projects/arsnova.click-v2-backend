import { ITitleMusicSessionConfiguration } from './ITitleMusicSessionConfiguration';
import { IVolumeMusicSessionConfiguration } from './IVolumeMusicSessionConfiguration';

export interface IMusicSessionConfiguration {
  enabled: {
    lobby: boolean; countdownRunning: boolean; countdownEnd: boolean;
  };
  volumeConfig: IVolumeMusicSessionConfiguration;
  titleConfig: ITitleMusicSessionConfiguration;
}
