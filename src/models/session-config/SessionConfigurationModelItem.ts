import { prop, Typegoose } from 'typegoose';
import { ISessionConfigurationSerialized } from '../../interfaces/session_configuration/ISessionConfigurationSerialized';
import { MusicSessionConfigurationModelItem } from './MusicSessionConfigurationModelItem';
import { NickSessionConfigurationModelItem } from './NickSessionConfigurationModelItem';

export class SessionConfigurationModelItem extends Typegoose implements ISessionConfigurationSerialized {
  @prop() public confidenceSliderEnabled: boolean;
  @prop() public music: MusicSessionConfigurationModelItem;
  @prop() public nicks: NickSessionConfigurationModelItem;
  @prop() public readingConfirmationEnabled: boolean;
  @prop() public showResponseProgress: boolean;
  @prop() public theme: string;
}
