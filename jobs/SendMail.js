const nodemailer = require('nodemailer');
const argv = require('minimist')(process.argv.slice(2));

class SendMail {

  constructor() {
    const host = process.env.ARSNOVA_CLICK_BACKEND_SMTP_HOST;
    const user = process.env.ARSNOVA_CLICK_BACKEND_SMTP_USERNAME;
    const pass = process.env.ARSNOVA_CLICK_BACKEND_SMTP_PASSWORD;
    const port = +process.env.ARSNOVA_CLICK_BACKEND_SMTP_PORT || 587;

    const from = process.env.ARSNOVA_CLICK_BACKEND_MAIL_FROM;
    const to = process.env.ARSNOVA_CLICK_BACKEND_MAIL_TO;

    if (!host || !user || !pass) {
      throw new Error(`Invalid smtp config specified. Host: ${host}, User: ${user}, Pass: ${pass}`);
    }

    if (!from || !to) {
      throw new Error(`Invalid mail config specified. From: ${from}, To: ${to}`);
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secureConnection: false,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      }
    });

    this.mailOptions = {
      from,
      to,
      subject: '',
      text: '',
      html: '',
      attachments: []
    };
  }

  help() {
    console.log('----------------------');
    console.log('Available commands:');
    console.log('help - Show this help');
    console.log('buildServerInfoMail(attachementContent, textContent, headerContent?) - Builds and prepares a Server Info E-Mail');
    console.log('send() - Sends the prepared E-Mail');
    console.log('----------------------');
  }

  buildServerInfoMail(attachementContent, textContent, headerContent) {
    this.mailOptions.subject = headerContent || 'Arsnova.click Server Report';
    this.mailOptions.text = `
    Error logged from the arsnova.click v2 backend server\n
    The error reported was:\n
    ${textContent}
    `;
    this.mailOptions.attachments = [
      {
        filename: 'dump.json',
        contentType: 'application/json',
        content: attachementContent
      },
    ];
  }

  send() {
    this.transporter.sendMail(this.mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  }
}

const sendMail = new SendMail();

if (process.argv.length < 2) {
  sendMail.help();
} else {

  if (!argv.command) {
    sendMail.help();
    return;
  }
  if (!sendMail[argv.command]) {
    console.log(`> Command ${argv.command} not found!`);
    sendMail.help();
    return;
  }

  switch (argv.command) {
    case 'buildServerInfoMail':
      if (!argv.attachment || !argv.text) {
        console.log(`> Command ${argv.command} requires missing parameter!`);
        sendMail.help();
        break;
      }
      sendMail.buildServerInfoMail(argv.attachment, argv.text, argv.header);
      sendMail.send();
      break;
    default:
      throw new Error(`No command handling specified for ${argv.command}`);
  }
}
