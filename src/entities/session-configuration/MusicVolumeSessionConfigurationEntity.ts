import { IVolumeMusicSessionConfigurationEntity } from '../../interfaces/session_configuration/music/IVolumeMusicSessionConfigurationEntity';
import { IVolumeMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/IVolumeMusicSessionConfigurationSerialized';

export class MusicVolumeSessionConfigurationEntity implements IVolumeMusicSessionConfigurationEntity {
  private _global: number;

  get global(): number {
    return this._global;
  }

  set global(value: number) {
    this._global = value;
  }

  private _lobby: number;

  get lobby(): number {
    return this._lobby;
  }

  set lobby(value: number) {
    this._lobby = value;
  }

  private _countdownRunning: number;

  get countdownRunning(): number {
    return this._countdownRunning;
  }

  set countdownRunning(value: number) {
    this._countdownRunning = value;
  }

  private _countdownEnd: number;

  get countdownEnd(): number {
    return this._countdownEnd;
  }

  set countdownEnd(value: number) {
    this._countdownEnd = value;
  }

  private _useGlobalVolume: boolean;

  get useGlobalVolume(): boolean {
    return this._useGlobalVolume;
  }

  set useGlobalVolume(value: boolean) {
    this._useGlobalVolume = value;
  }

  constructor({
                global, lobby, countdownRunning, countdownEnd, useGlobalVolume,
              }) {
    this._global = global;
    this._lobby = lobby;
    this._countdownRunning = countdownRunning;
    this._countdownEnd = countdownEnd;
    this._useGlobalVolume = useGlobalVolume;
  }

  public serialize(): IVolumeMusicSessionConfigurationSerialized {
    return {
      global: this.global,
      useGlobalVolume: this.useGlobalVolume,
      lobby: this.lobby,
      countdownRunning: this.countdownRunning,
      countdownEnd: this.countdownEnd,
    };
  }
}
