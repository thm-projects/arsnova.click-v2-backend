import path from 'path';
import fs from 'fs';
import gm from 'gm';
import readline from 'readline';

import derivates from '../assets/imageDerivates';
import process from 'process';
import child_process from 'child_process';

import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';

const themeData = JSON.parse(fs.readFileSync(path.join('..', 'assets', 'themeData.json')).toString());

const gmIM = gm.subClass({imageMagick: true});

const themes = [
  'theme-Material',
  'theme-Material-hope',
  'theme-Material-blue',
  'theme-arsnova-dot-click-contrast',
  'theme-blackbeauty',
  'theme-elegant',
  'theme-decent-blue',
  'theme-spiritual-purple',
  'theme-GreyBlue-Lime'
];

const languages = ['en', 'de', 'fr', 'it', 'es'];

const __dirname = path.resolve();

const gmToBuffer = (data) => {
  return new Promise((resolve, reject) => {
    data.stream((err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      const chunks = [];
      stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });
      // these are 'once' because they can and do fire multiple times for multiple errors,
      // but this is a promise so you'll have to deal with them one at a time
      stdout.once('end', () => {
        resolve(Buffer.concat(chunks));
      });
      stderr.once('data', (stderrmsg) => {
        reject(String(stderrmsg));
      });
    });
  });
};

class GenerateImages {

  constructor() {

    this.pathToAssets = path.join(__dirname, '..', 'assets');
    this.pathToDestination = path.join(this.pathToAssets, 'images', 'theme');

    if (!fs.existsSync(this.pathToDestination)) {
      fs.mkdirSync(this.pathToDestination);
    }
    Object.keys(themeData).forEach((themeName) => {
      const pathToThemeDestination = path.join(this.pathToDestination, themeName);
      if (!fs.existsSync(pathToThemeDestination)) {
        fs.mkdirSync(pathToThemeDestination);
      }
    });
  }

  help() {
    console.log('----------------------');
    console.log('Available commands:');
    console.log('help - Show this help');
    console.log('all - Will call all methods below');
    console.log('generateFrontendPreview - Adds the preview screenshots for the frontend. The frontend and the backend must be running!');
    console.log('generateLogoImages - Generates the logo images (used as favicon and manifest files)');
    console.log('----------------------');
  }

  all() {
    this.generateFrontendPreview();
    this.generateLogoImages();
  }

  generateFrontendPreview() {
    const CHROME_BIN = process.env.CHROME_BIN;
    const flags = ['--headless', '--hide-scrollbars', '--remote-debugging-port=9222', '--disable-gpu'];
    const params = [];
    const themePreviewEndpoint = `${process.env.BACKEND_THEME_PREVIEW_HOST || `http://localhost:4200`}/preview`;
    themes.forEach((theme) => {
      languages.forEach((languageKey) => {
        params.push(`${themePreviewEndpoint}/${theme}/${languageKey}`);
      });
    });

    const chromeInstance = child_process.spawn(CHROME_BIN, flags);
    const chromeDriver = child_process.spawn(`node`, [
      path.join(this.pathToAssets, '..', 'jobs', 'ChromeDriver.js'), `--urls=${JSON.stringify(params)}`
    ]);

    chromeDriver.stdout.on('data', (data) => {
      console.log(`ChromeDriver (stdout): ${data.toString().replace('\n', '')}`);
    });
    chromeDriver.stderr.on('data', (data) => {
      console.log(`ChromeDriver (stderr): ${data.toString().replace('\n', '')}`);
    });
    chromeDriver.on('exit', () => {
      console.log(`ChromeDriver (exit): All preview images have been generated`);
      chromeInstance.kill();
    });
  }

  generateLogoImages() {
    const source = path.join(this.pathToAssets, 'images', 'logo_transparent.png');

    Object.keys(themeData).forEach(async (themeName) => {
      await new Promise(resolveLogoImageGeneration => {
        const theme = themeData[themeName].quizNameRowStyle.bg;

        derivates.forEach(async (derivate) => {
          const splittedDerivate = derivate.split('x');
          const targetLogo = path.join(this.pathToDestination, `${themeName}`, `logo_s${derivate}.png`);
          const size = {
            width: splittedDerivate[0],
            height: splittedDerivate[1],
            roundX: Math.round((splittedDerivate[0] / Math.PI)),
            roundY: Math.round((splittedDerivate[1] / Math.PI))
          };

          const bgData = gm(1, 1, 'none')
          .setFormat('png')
          .fill(theme)
          .resize(size.width, size.height)
          .drawRectangle(0, 0, size.width, size.height, size.roundX, size.roundY)
          .compose('copyopacity');
          const bgBuffer = await gmToBuffer(bgData);
          if (!bgBuffer) {
            console.log('gm error', bgBuffer);
            return;
          }

          const fgData = gmIM(bgBuffer)
          .setFormat('png')
          .composite(source)
          .resize(size.width, size.height);
          const fgBuffer = await gmToBuffer(fgData);
          if (!fgBuffer) {
            console.log('gmIM error', fgBuffer);
            return;
          }

          const minifiedBuffer = await imagemin.buffer(fgBuffer, {
            plugins: [imageminPngquant({quality: '65-80'})]
          });
          fs.writeFileSync(targetLogo, minifiedBuffer, 'binary');
          console.log(`Icon with deriavate ${derivate} generated for theme ${themeName}`);
          resolveLogoImageGeneration();
        });
      });
    });
  }
}

const generateImages = new GenerateImages();

const executor = (line) => {
  if (!generateImages[line]) {
    console.log(`> Command ${line} not found!`);
    generateImages.help();
    return;
  }
  console.log(`> Executing command: ${line}`);
  generateImages[line]();
  console.log(`> Command execution finished`);
};

if (process.argv.length < 2) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  console.log('> Waiting for command');
  console.log('> Type \'help\' for a list of available commands');

  rl.on('line', executor);
} else {
  const command = process.argv.find(value => value.startsWith('--command='));
  if (command) {
    executor(command.replace('--command=', ''));
  }
}
