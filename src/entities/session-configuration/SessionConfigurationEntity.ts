import { LeaderboardConfiguration } from '../../enums/LeaderboardConfiguration';
import { ISessionConfigurationSerialized } from '../../interfaces/session_configuration/ISessionConfigurationSerialized';
import { AbstractSessionConfigurationEntity } from './AbstractSessionConfigurationEntity';
import { MusicSessionConfigurationEntity } from './MusicSessionConfigurationEntity';
import { MusicTitleSessionConfigurationEntity } from './MusicTitleSessionConfigurationEntity';
import { MusicVolumeSessionConfigurationEntity } from './MusicVolumeSessionConfigurationEntity';
import { NickSessionConfigurationEntity } from './NickSessionConfigurationEntity';

export class SessionConfigurationEntity extends AbstractSessionConfigurationEntity {
  constructor(options?: ISessionConfigurationSerialized) {
    if (!options) {
      options = {
        music: new MusicSessionConfigurationEntity({
          enabled: true,
          titleConfig: new MusicTitleSessionConfigurationEntity({
            countdownEnd: '',
            countdownRunning: '',
            lobby: '',
          }),
          volumeConfig: new MusicVolumeSessionConfigurationEntity({
            lobby: 0,
            countdownRunning: 0,
            countdownEnd: 0,
            global: 0,
            useGlobalVolume: true,
          }),
        }),
        nicks: new NickSessionConfigurationEntity({
          selectedNicks: [],
          autoJoinToGroup: true,
          blockIllegalNicks: true,
          maxMembersPerGroup: 10,
          memberGroups: [],
          restrictToCasLogin: true,
        }),
        confidenceSliderEnabled: true,
        leaderboardAlgorithm: LeaderboardConfiguration.PointBased,
        readingConfirmationEnabled: true,
        showResponseProgress: true,
        theme: 'Material',
      };
    }

    super(options);
  }
}
