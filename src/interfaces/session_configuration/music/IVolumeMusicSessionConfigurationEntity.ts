import { IVolumeMusicSessionConfigurationSerialized } from './IVolumeMusicSessionConfigurationSerialized';

export interface IVolumeMusicSessionConfigurationEntity extends IVolumeMusicSessionConfigurationSerialized {
  serialize(): IVolumeMusicSessionConfigurationSerialized;
}
