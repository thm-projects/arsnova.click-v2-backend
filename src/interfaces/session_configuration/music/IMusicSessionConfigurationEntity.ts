import { IMusicSessionConfigurationSerialized } from './IMusicSessionConfigurationSerialized';
import { ITitleMusicSessionConfigurationEntity } from './ITitleMusicSessionConfigurationEntity';
import { IVolumeMusicSessionConfigurationEntity } from './IVolumeMusicSessionConfigurationEntity';

export interface IMusicSessionConfigurationEntity extends IMusicSessionConfigurationSerialized {
  volumeConfig: IVolumeMusicSessionConfigurationEntity;
  titleConfig: ITitleMusicSessionConfigurationEntity;

  serialize(): IMusicSessionConfigurationSerialized;

  equals(value: IMusicSessionConfigurationSerialized): boolean;
}
