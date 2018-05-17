const path = require('path');
const args = process.argv;
const phantom = require('phantom');

args.shift();
args.shift();
console.log(`Received argument list [${args}]`);
init();

let instance, page;

async function init() {
  const url = args[0];
  const host = /localhost/.test(url) ?
    'localhost' : /staging.arsnova.click/.test(url) ?
      'staging.arsnova.click' : /beta.arsnova.click/.test(url) ?
        'beta.arsnova.click' : /arsnova.click/.test(url) ?
          'arsnova.click' : '';

  instance = await phantom.create();
  console.log('instance created');

  page = await instance.createPage();
  console.log('page created');

  // await page.property('viewportSize', { width: 200, height: 600 });
  // console.log('viewport set');

  page.addCookie({
    'name': 'cookieconsent_status',
    'value': 'dismiss',
    'domain': host,
    'path': '/',
    'expires': (new Date()).getTime() + (1000 * 60 * 60)
  });
  console.log('cookie set');

  handlePageLoad();
}

async function nextPage() {
  const url = args.shift();
  if (!url) {
    console.log('All files have been handled, exiting process');
    await instance.exit();
    return;
  }

  return url;
}

async function handlePageLoad() {
  const url = await nextPage();
  if (!url) {
    await instance.exit();
    return;
  }
  console.log(`Handling url [${url}]`);

  const status = await page.open(url);
  console.log(`Page opened with status [${status}].`);

  await page.evaluate(function() {
    return document.getElementById('content-container').classList.add('is-phantom');
  });
  console.log('Set class name of \'#content-container\' to \'is-phantom\' (flexbox bug)');

  const urlSeparated = url.split('/');
  const imgPath = path.join(__dirname, '..', 'assets', 'images', 'theme', urlSeparated[urlSeparated.length - 2], 'preview_' + urlSeparated[urlSeparated.length - 1] + '.png');
  await page.render(imgPath, {format: 'jpg', quality: 50});
  console.log(`Image created: ${imgPath}`);

  handlePageLoad();
}
