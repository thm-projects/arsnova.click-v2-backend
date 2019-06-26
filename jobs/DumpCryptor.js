const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const homedir = require('os').homedir();

class DumpCryptor {

  constructor() {
    this.pathToBase = path.join(__dirname, '..');
    this.pathToOutput = path.join(homedir, '.arsnova-click-v2-backend');
    this.pathToSalt = path.join(this.pathToOutput, 'dump_cryptor_salt');
    this.buildPaths();
  }

  buildPaths() {
    this.pathToAssets = path.join(this.pathToBase, 'assets');
    this.cert = fs.readFileSync(`${path.join(this.pathToAssets, 'dump_cert.pem')}`, 'ascii');
    this.skey = this.getKeyAndIV(this.cert);

    if (!fs.existsSync(this.pathToOutput)) {
      fs.mkdirSync(this.pathToOutput);
    }
  }

  help() {
    console.log('----------------------');
    console.log('Available commands:');
    console.log('help - Show this help');
    console.log('encrypt(data: string, output-file?: string) - Encrypt a plain text or object to a dump file');
    console.log('decrypt(input-file: string, output-file?: string) - Decrypt a dump file and save the output to a json file');
    console.log('----------------------');
  }

  getKeyAndIV(password) {

    const keyBitLength = 256;
    const ivBitLength = 128;
    const iterations = 234;

    let salt = null;
    if (fs.existsSync(this.pathToSalt)) {
      salt = JSON.parse(fs.readFileSync(this.pathToSalt, {encoding: 'UTF-8'}));
    } else {
      const bytesInSalt = 128 / 8;
      salt = CryptoJS.lib.WordArray.random(bytesInSalt);
      fs.writeFileSync(this.pathToSalt, JSON.stringify(salt));
    }

    const iv128Bits = CryptoJS.PBKDF2(password, salt, {keySize: ivBitLength / 32, iterations: iterations});
    const key256Bits = CryptoJS.PBKDF2(password, salt, {keySize: keyBitLength / 32, iterations: iterations});

    return {
      iv: iv128Bits,
      key: key256Bits,
    };
  }

  encrypt(plainData, outputFile) {
    if (!plainData) {
      throw new Error('No data to encrypt specified - use --data=<plain-text>');
    }
    if (!outputFile) {
      const date = new Date();
      const dateFormatted = `${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}-${date.getHours()}_${date.getMinutes()}`;
      outputFile = `dump_${dateFormatted}`;
    }

    const fd = fs.openSync(`${path.join(this.pathToOutput, outputFile)}`, 'w');
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(plainData), this.skey.key, {iv: this.skey.iv});

    fs.writeSync(fd, encryptedData.ciphertext.toString(CryptoJS.enc.Base64));
    fs.closeSync(fd);

    return encryptedData;
  }

  decrypt(inputFile, outputFile) {
    if (!inputFile) {
      throw new Error('No input file specified - use --input-file=<path-to-file>');
    }
    if (!outputFile) {
      outputFile = inputFile.replace('dump', 'decrypted_dump');
    }

    const inputFileContent = fs.readFileSync(`${path.join(this.pathToOutput, inputFile)}`);
    const parsedStr = inputFileContent.toString('UTF-8');
    const base64 = CryptoJS.enc.Base64.parse(parsedStr);
    const salt = JSON.parse(fs.readFileSync(this.pathToSalt));
    const clearText = CryptoJS.AES.decrypt({
      ciphertext: base64,
      salt: salt,
    }, this.skey.key, {iv: this.skey.iv});

    const fd = fs.openSync(`${path.join(this.pathToOutput, outputFile)}`, 'w');
    fs.writeSync(fd, JSON.parse(clearText.toString(CryptoJS.enc.Utf8)));
    fs.closeSync(fd);

    return clearText.toString(CryptoJS.enc.Utf8);
  }
}

const dumpCryptor = new DumpCryptor();

if (process.argv.length < 2) {
  dumpCryptor.help();
} else {
  if (argv['base-path']) {
    dumpCryptor.pathToBase = argv['base-path'];
    dumpCryptor.buildPaths();
  }

  if (!argv.command) {
    dumpCryptor.help();
    return;
  }
  if (!dumpCryptor[argv.command]) {
    console.log(`> Command ${argv.command} not found!`);
    dumpCryptor.help();
    return;
  }

  switch (argv.command) {
    case 'encrypt':
      if (!argv.data) {
        console.log(`> Command ${argv.command} requires missing parameter!`);
        dumpCryptor.help();
        break;
      }
      dumpCryptor.encrypt(argv.data, argv['output-file']);
      break;
    case 'decrypt':
      if (!argv['input-file']) {
        console.log(`> Command ${argv.command} requires missing parameter!`);
        dumpCryptor.help();
        break;
      }
      dumpCryptor.decrypt(argv['input-file'], argv['output-file']);
      break;
    default:
      throw new Error(`No command handling specified for ${argv.command}`);
  }
}
