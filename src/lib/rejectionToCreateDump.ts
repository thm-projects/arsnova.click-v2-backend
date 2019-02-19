import { IGlobal } from '../main';
import LoggerService from '../services/LoggerService';

export function rejectionToCreateDump(reason): void {
  try {
    (<IGlobal>global).createDump(reason);
  } catch (e) {
    LoggerService.error('Cannot create dump', e.message);
  } finally {
    console.error(reason.stack || reason.message || reason);
  }
}
