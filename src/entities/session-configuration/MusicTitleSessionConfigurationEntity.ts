import { ITitleMusicSessionConfigurationEntity } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfigurationEntity';
import { ITitleMusicSessionConfigurationSerialized } from '../../interfaces/session_configuration/music/ITitleMusicSessionConfigurationSerialized';

export class MusicTitleSessionConfigurationEntity implements ITitleMusicSessionConfigurationEntity {
  private _lobby: string;

  get lobby(): string {
    return this._lobby;
  }

  set lobby(value: string) {
    this._lobby = value;
  }

  private _countdownRunning: string;

  get countdownRunning(): string {
    return this._countdownRunning;
  }

  set countdownRunning(value: string) {
    this._countdownRunning = value;
  }

  private _countdownEnd: string;

  get countdownEnd(): string {
    return this._countdownEnd;
  }

  set countdownEnd(value: string) {
    this._countdownEnd = value;
  }

  constructor({
                lobby, countdownRunning, countdownEnd,
              }) {
    this._lobby = lobby;
    this._countdownRunning = countdownRunning;
    this._countdownEnd = countdownEnd;
  }

  public serialize(): ITitleMusicSessionConfigurationSerialized {
    return {
      lobby: this.lobby,
      countdownRunning: this.countdownRunning,
      countdownEnd: this.countdownEnd,
    };
  }
}
