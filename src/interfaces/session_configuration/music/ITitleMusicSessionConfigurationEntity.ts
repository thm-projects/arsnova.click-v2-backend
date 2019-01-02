import { ITitleMusicSessionConfigurationSerialized } from './ITitleMusicSessionConfigurationSerialized';

export interface ITitleMusicSessionConfigurationEntity extends ITitleMusicSessionConfigurationSerialized {
  serialize(): ITitleMusicSessionConfigurationSerialized;
}
