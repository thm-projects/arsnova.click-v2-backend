import { IMusicSessionConfigurationEntity } from '../../interfaces/session_configuration/music/IMusicSessionConfigurationEntity';
import { IMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/IMusicSessionConfigurationSerialized';
import { ITitleMusicSessionConfigurationEntity } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfigurationEntity';
import { IVolumeMusicSessionConfigurationEntity } from '../../interfaces/session_configuration/music/IVolumeMusicSessionConfigurationEntity';
import { MusicTitleSessionConfigurationEntity } from './MusicTitleSessionConfigurationEntity';
import { MusicVolumeSessionConfigurationEntity } from './MusicVolumeSessionConfigurationEntity';

export class MusicSessionConfigurationEntity implements IMusicSessionConfigurationEntity {
  public enabled = {
    lobby: true,
    countdownRunning: true,
    countdownEnd: true,
  };

  private _volumeConfig: IVolumeMusicSessionConfigurationEntity;

  get volumeConfig(): IVolumeMusicSessionConfigurationEntity {
    return this._volumeConfig;
  }

  set volumeConfig(value: IVolumeMusicSessionConfigurationEntity) {
    this._volumeConfig = value;
  }

  private _titleConfig: ITitleMusicSessionConfigurationEntity;

  get titleConfig(): ITitleMusicSessionConfigurationEntity {
    return this._titleConfig;
  }

  set titleConfig(value: ITitleMusicSessionConfigurationEntity) {
    this._titleConfig = value;
  }

  constructor({
                volumeConfig, titleConfig, enabled,
              }) {
    this.volumeConfig = new MusicVolumeSessionConfigurationEntity(volumeConfig);
    this.titleConfig = new MusicTitleSessionConfigurationEntity(titleConfig);
    this.enabled = enabled;
  }

  public serialize(): IMusicSessionConfigurationSerialized {
    return {
      enabled: this.enabled,
      volumeConfig: this.volumeConfig.serialize(),
      titleConfig: this.titleConfig.serialize(),
    };
  }

  public equals(value: IMusicSessionConfigurationEntity): boolean {
    return (this.volumeConfig.global === value.volumeConfig.global && //
            this.volumeConfig.lobby === value.volumeConfig.lobby && //
            this.volumeConfig.countdownRunning === value.volumeConfig.countdownRunning && //
            this.volumeConfig.countdownEnd === value.volumeConfig.countdownEnd && //
            this.titleConfig.lobby === value.titleConfig.lobby && //
            this.titleConfig.countdownRunning === value.titleConfig.countdownRunning && //
            this.titleConfig.countdownEnd === value.titleConfig.countdownEnd && //
            this.enabled.lobby === value.enabled.lobby && //
            this.enabled.countdownRunning === value.enabled.countdownRunning && //
            this.enabled.countdownEnd === value.enabled.countdownEnd //
    );
  }
}
