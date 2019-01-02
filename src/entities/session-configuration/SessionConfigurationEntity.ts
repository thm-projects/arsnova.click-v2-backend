import { ISessionConfigurationSerialized } from '../../interfaces/session_configuration/ISessionConfigurationSerialized';
import { AbstractSessionConfigurationEntity } from './AbstractSessionConfigurationEntity';

export class SessionConfigurationEntity extends AbstractSessionConfigurationEntity {
  constructor(options?: ISessionConfigurationSerialized) {
    super(options);
  }
}
