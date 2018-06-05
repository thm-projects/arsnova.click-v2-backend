const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

class DumpDecryptor {

  constructor() {

    this.pathToBase = path.join(__dirname, '..');
    this.pathToAssets = path.join(this.pathToBase, 'assets');
    this.cert = fs.readFileSync(`${path.join(this.pathToAssets, 'dump_cert.pem')}`, 'ascii');
    this.skey = this.getKeyAndIV(this.cert);
  }

  help() {
    console.log('----------------------');
    console.log('Available commands:');
    console.log('help - Show this help');
    console.log('encrypt - Encrypt a plain text or object to a dump file');
    console.log('decrypt - Decrypts a dump file');
    console.log('----------------------');
  }

  getKeyAndIV(password) {

    const keyBitLength = 256;
    const ivBitLength = 128;
    const iterations = 234;

    // TODO: Think about storing the salt securely
    // const bytesInSalt = 128 / 8;
    // const salt = CryptoJS.lib.WordArray.random(bytesInSalt);
    const salt = '';

    const iv128Bits = CryptoJS.PBKDF2(password, salt, {keySize: ivBitLength / 32, iterations: iterations});
    const key256Bits = CryptoJS.PBKDF2(password, salt, {keySize: keyBitLength / 32, iterations: iterations});

    return {
      iv: iv128Bits,
      key: key256Bits,
    };
  }

  encrypt(plainData, inputFileName = 'dump') {
    const fd = fs.openSync(`${path.join(this.pathToBase, inputFileName)}`, 'w');
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(plainData), this.skey.key, {iv: this.skey.iv});

    fs.writeSync(fd, encryptedData.ciphertext.toString(CryptoJS.enc.Base64));
    fs.closeSync(fd);

    return encryptedData;
  }

  decrypt(inputFileName = 'dump') {
    const inputFile = fs.readFileSync(`${path.join(this.pathToBase, inputFileName)}`);
    const parsedStr = inputFile.toString('UTF-8');
    const base64 = CryptoJS.enc.Base64.parse(parsedStr);
    const clearText = CryptoJS.AES.decrypt({
      ciphertext: base64,
      salt: '',
    }, this.skey.key, {iv: this.skey.iv});

    return clearText.toString(CryptoJS.enc.Utf8);
  }
}

const dumpCryptor = new DumpDecryptor();

const executor = (line, argument) => {
  if (!dumpCryptor[line]) {
    console.log(`> Command ${line} not found!`);
    dumpCryptor.help();
    return;
  }
  console.log(`> Executing command: ${line}`);
  const result = dumpCryptor[line](argument);
  console.log(`> Command execution finished, return value was: ${result}`);
};

if (process.argv.length < 2) {
  dumpCryptor.help();
} else {
  let basePath = process.argv.find(value => value.startsWith('--base-path=') ? value : null);
  if (basePath) {
    dumpCryptor.pathToBase = basePath.replace('--base-path=', '');
  }

  const command = process.argv.find(value => value.startsWith('--command=') ? value : null);
  if (command) {
    let data = process.argv.find(value => value.startsWith('--data=') ? value : null);
    if (data) {
      data = data.replace('--data=', '');
    }
    executor(command.replace('--command=', ''), data);
  } else {
    dumpCryptor.help();
  }
}
