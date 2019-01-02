import * as bunyan from 'bunyan';
import { LogLevel } from 'bunyan';
import * as process from 'process';
import { staticStatistics } from '../statistics';

class LoggerService {

  private static instance: LoggerService;

  private _logger: bunyan;

  get logger(): bunyan {
    return this._logger;
  }

  private _logQueue: Array<{ level: LogLevel, msg: string }>;

  constructor() {
    this._logQueue = [];
    this.init();
  }

  public static getInstance(): LoggerService {
    if (!this.instance) {
      this.instance = new LoggerService();
    }

    return this.instance;
  }

  public info(...messages: Array<string | number>): void {
    const parsedMessages = messages.join(' ');

    if (!this._logger) {
      this._logQueue.push({
        level: 'info',
        msg: parsedMessages,
      });
      return;
    }

    this._logger.info(parsedMessages);
  }

  public error(...messages: Array<string | number>): void {
    const parsedMessages = messages.join(' ');

    if (!this._logger) {
      this._logQueue.push({
        level: 'error',
        msg: parsedMessages,
      });
      return;
    }

    this._logger.error(parsedMessages);
  }

  public debug(...messages: Array<string | number>): void {
    const parsedMessages = messages.join(' ');

    if (!this._logger) {
      this._logQueue.push({
        level: 'debug',
        msg: parsedMessages,
      });
      return;
    }

    this._logger.debug(parsedMessages);
  }

  private async init(): Promise<void> {
    const level: LogLevel = <LogLevel>process.env.LOG_LEVEL || 'info';

    const streams = [];

    if (process.env.NODE_ENV !== 'test') {
      streams.push({
        stream: process.stdout,
      });
    }

    this.createLogging(level, streams);
  }

  private createLogging(level: LogLevel, streams: Array<bunyan.Stream>): void {
    this._logger = bunyan.createLogger({
      name: staticStatistics.appName,
      level,
      streams,
    });

    this._logQueue.forEach((logLevelQueue) => {
      this[logLevelQueue.level].call(this, logLevelQueue.msg);
    });
    this._logQueue.splice(0, this._logQueue.length);
  }
}

export default LoggerService.getInstance();
