/*
 * This file is part of ARSnova Click.
 * Copyright (C) 2016 The ARSnova Team
 *
 * ARSnova Click is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ARSnova Click is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ARSnova Click.  If not, see <http://www.gnu.org/licenses/>.*/

import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { ISessionConfigurationEntity } from '../../interfaces/session_configuration/ISessionConfigurationEntity';
import { ISessionConfigurationSerialized } from '../../interfaces/session_configuration/ISessionConfigurationSerialized';
import { IMusicSessionConfigurationEntity } from '../../interfaces/session_configuration/music/IMusicSessionConfigurationEntity';
import { INickSessionConfigurationEntity } from '../../interfaces/session_configuration/nicks/INickSessionConfigurationEntity';
import { MusicSessionConfigurationEntity } from './MusicSessionConfigurationEntity';
import { NickSessionConfigurationEntity } from './NickSessionConfigurationEntity';

export abstract class AbstractSessionConfigurationEntity implements ISessionConfigurationEntity {
  private _music: IMusicSessionConfigurationEntity;

  get music(): IMusicSessionConfigurationEntity {
    return this._music;
  }

  set music(value: IMusicSessionConfigurationEntity) {
    this._music = value;
  }

  private _nicks: INickSessionConfigurationEntity;

  get nicks(): INickSessionConfigurationEntity {
    return this._nicks;
  }

  set nicks(value: INickSessionConfigurationEntity) {
    this._nicks = value;
  }

  private _theme: string;

  get theme(): string {
    return this._theme;
  }

  set theme(value: string) {
    this._theme = value;
  }

  private _readingConfirmationEnabled: boolean;

  get readingConfirmationEnabled(): boolean {
    return this._readingConfirmationEnabled;
  }

  set readingConfirmationEnabled(value: boolean) {
    this._readingConfirmationEnabled = value;
  }

  private _showResponseProgress: boolean;

  get showResponseProgress(): boolean {
    return this._showResponseProgress;
  }

  set showResponseProgress(value: boolean) {
    this._showResponseProgress = value;
  }

  private _confidenceSliderEnabled: boolean;

  get confidenceSliderEnabled(): boolean {
    return this._confidenceSliderEnabled;
  }

  set confidenceSliderEnabled(value: boolean) {
    this._confidenceSliderEnabled = value;
  }

  private _leaderboardAlgorithm: LeaderboardConfiguration;

  get leaderboardAlgorithm(): LeaderboardConfiguration {
    return this._leaderboardAlgorithm;
  }

  set leaderboardAlgorithm(value: LeaderboardConfiguration) {
    this._leaderboardAlgorithm = value;
  }

  protected constructor({
                          music, nicks, theme, readingConfirmationEnabled, showResponseProgress, confidenceSliderEnabled, leaderboardAlgorithm,
                        }) {
    this.music = new MusicSessionConfigurationEntity(music);
    this.nicks = new NickSessionConfigurationEntity(nicks);
    this.theme = theme;
    this.readingConfirmationEnabled = readingConfirmationEnabled;
    this.showResponseProgress = showResponseProgress;
    this.confidenceSliderEnabled = confidenceSliderEnabled;
    this.leaderboardAlgorithm = leaderboardAlgorithm;
  }

  public serialize(): ISessionConfigurationSerialized {
    return {
      music: this.music.serialize(),
      nicks: this.nicks.serialize(),
      theme: this.theme,
      readingConfirmationEnabled: this.readingConfirmationEnabled,
      showResponseProgress: this.showResponseProgress,
      confidenceSliderEnabled: this.confidenceSliderEnabled,
      leaderboardAlgorithm: this.leaderboardAlgorithm,
    };
  }

  public equals(value: ISessionConfigurationEntity): boolean {
    return this.music.equals(value.music) && this.nicks.equals(value.nicks) && this.theme === value.theme && this.readingConfirmationEnabled
           === value.readingConfirmationEnabled && this.showResponseProgress === value.showResponseProgress && this.confidenceSliderEnabled
           === value.confidenceSliderEnabled && value.leaderboardAlgorithm === this.leaderboardAlgorithm;
  }
}
