const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const homedir = require('os').homedir();
const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const MemoryDb = require('lowdb/adapters/Memory');

class LoginGenerator {

  constructor() {
  }

  buildOutputPaths() {
    this.pathToOutput = path.join(homedir, '.arsnova-click-v2-backend');
    this.pathToDb = path.join(this.pathToOutput, 'arsnova-click-v2-db-v1.json');
    this.adapter = new FileSync(this.pathToDb);
    this.db = lowdb(this.adapter);
    this.buildPaths();
  }

  buildPaths() {
    if (!fs.existsSync(this.pathToOutput)) {
      fs.mkdirSync(this.pathToOutput);
    }
  }

  help() {
    console.log('----------------------');
    console.log('Available commands:');
    console.log('help - Show this help');
    console.log('generate(username: string, password: string) - Creates a new user in the db with the given username and the password');
    console.log('----------------------');
  }

  generate(username, password) {
    this.buildOutputPaths();

    if (!this.db.getState()['users']) {
      this.db.set('users', {}).write();
    }

    if (this.db.get('users').find({username}).value()) {
      throw new Error('User already exists');
    }

    const hash = this.sha1(`${username}|${password}`);
    this.db.set(`users.${username}`, {
      username, passwordHash: hash, gitlabToken: "", userAuthorizations: []
    }).write();

    console.log('User added');
  }

  rotl(n, s) {
    return n << s | n >>> 32 - s;
  }

  tohex(i2) {
    for (let h = '', s = 28; ; s -= 4) {
      h += (
        i2 >>> s & 0xf
      ).toString(16);
      if (!s) {
        return h;
      }
    }
  }

  sha1(msg) {
    let H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;
    let i, t;
    const M = 0x0ffffffff, W = new Array(80), ml = msg.length, wa = [];
    msg += String.fromCharCode(0x80);
    while (msg.length % 4) {
      msg += String.fromCharCode(0);
    }
    for (i = 0; i < msg.length; i += 4) {
      wa.push(msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3));
    }
    while (wa.length % 16 !== 14) {
      wa.push(0);
    }
    wa.push(ml >>> 29);
    wa.push((
      ml << 3
    ) & M);
    for (let bo = 0; bo < wa.length; bo += 16) {
      for (i = 0; i < 16; i++) {
        W[i] = wa[bo + i];
      }
      for (i = 16; i <= 79; i++) {
        W[i] = this.rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
      }
      let A = H0, B = H1, C = H2, D = H3, E = H4;
      for (i = 0; i <= 19; i++) {
        t = (
          this.rotl(A, 5) + (
            B & C | ~B & D
          ) + E + W[i] + 0x5A827999
        ) & M, E = D, D = C, C = this.rotl(B, 30), B = A, A = t;
      }
      for (i = 20; i <= 39; i++) {
        t = (
          this.rotl(A, 5) + (
            B ^ C ^ D
          ) + E + W[i] + 0x6ED9EBA1
        ) & M, E = D, D = C, C = this.rotl(B, 30), B = A, A = t;
      }
      for (i = 40; i <= 59; i++) {
        t = (
          this.rotl(A, 5) + (
            B & C | B & D | C & D
          ) + E + W[i] + 0x8F1BBCDC
        ) & M, E = D, D = C, C = this.rotl(B, 30), B = A, A = t;
      }
      for (i = 60; i <= 79; i++) {
        t = (
          this.rotl(A, 5) + (
            B ^ C ^ D
          ) + E + W[i] + 0xCA62C1D6
        ) & M, E = D, D = C, C = this.rotl(B, 30), B = A, A = t;
      }
      H0 = H0 + A & M;
      H1 = H1 + B & M;
      H2 = H2 + C & M;
      H3 = H3 + D & M;
      H4 = H4 + E & M;
    }
    return this.tohex(H0) + this.tohex(H1) + this.tohex(H2) + this.tohex(H3) + this.tohex(H4);
  }

  generateMongoDbUser() {
    var MongoClient = require('mongodb').MongoClient;
    var url = `mongodb://${argv.username}:${argv.password}@localhost:27017/arsnova-click-v2`;
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db("arsnova-click-v2");
      var user = {name: "default-user", passwordHash: "cb14db1f6b75333ed9a09c4819d0aa538da8b8f3", userAuthorizations: ['SuperAdmin']};
      dbo.collection("users").insertOne(user, function (err, res) {
        if (err) throw err;
        console.log("1 user created");
        db.close();
      });
    });
  }
}

const loginGenerator = new LoginGenerator();

if (process.argv.length < 2) {
  loginGenerator.help();
} else {

  if (!argv.username || !argv.password) {
    loginGenerator.help();
    return;
  }

  if (argv['base-path']) {
    loginGenerator.pathToBase = argv['base-path'];
    loginGenerator.buildPaths();
  }

  if (argv.adapter) {
    switch (argv.adapter) {
      case 'FileSync':
        break;
      case 'MemoryDb':
        loginGenerator.adapter = new MemoryDb('');
        loginGenerator.db = lowdb(loginGenerator.adapter);
        break;
      case 'MongoDb':
        loginGenerator.generateMongoDbUser();
        return;
      default:
        throw new Error(`DB Type ${argv.adapter} is currently not supported. Use 'MemoryDb', 'MongoDb' or 'FileSync' instead`);
    }
  }

  loginGenerator.generate(argv.username, argv.password);
}
