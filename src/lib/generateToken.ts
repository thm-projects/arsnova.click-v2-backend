import * as CryptoJS from 'crypto-js';
import { jsonCensor } from './jsonCensor';

export const generateToken = (...args: Array<any>): string => {
  return CryptoJS.SHA3(JSON.stringify(args, jsonCensor(args))).toString(CryptoJS.enc.Hex);
};
