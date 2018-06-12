#### arsnova.click v2 Backend

###### Environment Variables
These are the basic variables required to run the server
- `ARSNOVA_CLICK_BACKEND_PORT_INTERNAL [number]`: This is the external port used for rewriting the urls of cached quizzes (defaults to 3000 if unset)
- `ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL [number]`: This is the internal port used during the startup of the server (defaults to 3000 if unset)
- `ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX [string]`: The routePrefix is used to prefix the access of the Express routes. E.g if set to 'backend' the access to '/api/v1/myPath' will become '/backend/api/v1/myPath'  (defaults to `/` if unset)
- `ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL [string]`: This configuration is used as base endpoint for cached assets  (defaults to `http://${hostname()}:${BACKEND_PORT_EXTERNAL}${BACKEND_ROUTE_PREFIX}` if unset)

To send E-Mails it is required to provide additional variables:
- `ARSNOVA_CLICK_BACKEND_SMTP_HOST [string]`: Points to the smtp host
- `ARSNOVA_CLICK_BACKEND_SMTP_PORT [number]`: The port of the smtp installation (defaults to 587 if unset)
- `ARSNOVA_CLICK_BACKEND_SMTP_USERNAME [string]`: The username to use for the smtp connection
- `ARSNOVA_CLICK_BACKEND_SMTP_PASSWORD [string]`: The password of the username
- `ARSNOVA_CLICK_BACKEND_MAIL_FROM [string]`: The `from` header of the E-Mails
- `ARSNOVA_CLICK_BACKEND_MAIL_TO [string]`: The `to` header of the E-Mails

###### Dumps
The server will generate dumps if an Error is thrown.
The dump will contain the serialized error and the state of the DAOs. 
Since the DAOs may contain personal data they are encrypted before stored on the file system. 
The encryption certificate (`dist/assets/dump_cert.pem`) may be exchanged by a customized one during the build process.

###### Jobs
- The `DumpCryptor` job allows encryption and decryption of generated dumps.
- The `SendMail` job uses the nodemailer package to send emails (e.g. error reports).

###### Test
Enter `npm test` in the root directory to run the unit tests. 
Note that since is uses a TypeScript runner for Mocha it is not required to build the server app before testing it.
Thus, the server gets started up during the test so the specified port must be available.
Currently the routing and the quiz export is covered by the tests. 
The export unit test will generate a random filled Excel export file in the `${rootDir}/test-generated` folder.

###### Build (DEV)
Enter `npm run build:DEV` in the root directory to run the dev build.

Using IntelliJ IDEA it is possible to create a `Node.js Run Configuration`. 
Use `--inspect=9229 --inspect-brk main.js` as node parameters, set the `dist/` directory as working dir and set the main.js as entry point. 
Trigger the command `npm run build:DEV` as a before launch. 
This will make it possible to use breakpoints in the node.js app.

###### Build (PROD)
Enter `npm run build:PROD` in the root directory to run the prod build.
Since it is not required to minify / uglify the serverside code the production build command is an alias for the dev build.
