import * as i18n from 'i18n';
import * as path from 'path';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { Language } from '../../enums/Enums';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';

i18n.configure({
  // setup some locales - other locales default to en silently
  locales: Object.values(Language),

  // fall back from Dutch to German
  fallbacks: { 'nl': 'de' },

  // where to store json files - defaults to './locales' relative to modules directory
  directory: path.join(staticStatistics.pathToAssets, 'i18n'),

  // watch for changes in json files to reload locale on updates - defaults to false
  autoReload: true,

  // whether to write new locale information to disk - defaults to true
  updateFiles: false,

  // sync locale information across all files - defaults to false
  syncFiles: false,

  // what to use as the indentation unit - defaults to "\t"
  indent: '\t',

  // setting extension of json files - defaults to '.json' (you might want to set this to '.js' according to webtranslateit)
  extension: '.json',

  // setting prefix of json files name - default to none ''
  // (in case you use different locale files naming scheme (webapp-en.json), rather then just en.json)
  prefix: '',

  // enable object notation
  objectNotation: true,

  // setting of log level DEBUG - default to require('debug')('i18n:debug')
  logDebugFn: require('debug')('i18n:debug'),

  // setting of log level WARN - default to require('debug')('i18n:warn')
  logWarnFn: msg => {
    LoggerService.info(msg);
  },

  // setting of log level ERROR - default to require('debug')('i18n:error')
  logErrorFn: msg => {
    LoggerService.error(msg);
  },

  // object or [obj1, obj2] to bind the i18n api and current locale to - defaults to null
  register: global,

  // hash to specify different aliases for i18n's internal methods to apply on the request/response objects (method -> alias).
  // note that this will *not* overwrite existing properties with the same name
  api: {
    '__': 't',  // now req.__ becomes req.t
    '__n': 'tn', // and req.__n can be called as req.tn
  },
});

@Middleware({ type: 'before' })
export class I18nMiddleware implements ExpressMiddlewareInterface {

  public use(request: any, response: any, next: (err?: any) => any): void {
    i18n.init(request, response, next);
  }
}
