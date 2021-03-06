#### arsnova.click v2 Backend

###### Installation

You can find an Installationguide [here](https://github.com/thm-projects/arsnova.click-v2/blob/master/documentation/Backend-Installationguide.md)  


###### Additional noticable files
- arsnova-click.env - This file contains all environment variables for the arsnova-click backend
    - `TWITTER_ENABLED`: Flag if the twitter polling should be enabled (default: `false`)
    - `TWITTER_CONSUMER_KEY`: Consumer API Key from Twitter
    - `TWITTER_CONSUMER_SECRET`: Consumer API Key secret from Twitter
    - `TWITTER_ACCESS_TOKEN_KEY`: Access Token from Twitter
    - `TWITTER_ACCESS_TOKEN_SECRET`: Access Token secret from Twitter
    - `TWITTER_BEARER_TOKEN`: Bearer Token from Twitter. If a bearer token is provided access tokens will not be used (see `https://developer.twitter.com/en/docs/basics/authentication/oauth-2-0/bearer-tokens`)
    - `TWITTER_SEARCH_KEY`: Key to search for tweets on Twitter (default: `arsnova.click`)
    - `CHROMIUM_PATH`: Path to a local chromium instance (default: `/usr/bin/chromium-browser`)
    - `MONGODB_SERVICE_NAME`: Hostname of the MongoDB (eg: `mongodb`)
    - `MONGODB_DATABASE`: Database name (eg: `arsnova-click-v2`)
    - `MONGODB_USER`: User with access to the `MONGODB_DATABASE`
    - `MONGODB_PASSWORD`: Password of the user provided with `MONGODB_USER`
    - `MONGODB_AUTH_SOURCE`: *[Optional]* The database of the auth db
    - `LOG_LEVEL`: *[Optional]* Log level of the node process (eg: `debug`)
    - `NODE_ENV`: *[Optional]* Node Environment (eg: `development`)
    - `GITLAB_HOST`: *[Optional]* Host where to find the gitlab projects for frontend and backend (eg: `https://git.thm.de`)
    - `GITLAB_TOKEN`: *[Optional]* Access Token for gitlab project to retrieve and parse i18n files
    - `GITLAB_BACKEND_PROJECT_ID`: *[Optional]* Project ID where the backend i18n files are found
    - `GITLAB_FRONTEND_PROJECT_ID`: *[Optional]* Project ID where the frontend i18n files are found
    - `GITLAB_TARGET_BRANCH`: *[Optional]* Branch name of the frontend and backend project which will be used to consume the i18n files (default: `master`)
    - `AMQP_HOSTNAME`: Hostname of the AMQP Server (eg: `rabbitmq`)
    - `AMQP_USER`: User with access to the AMQP Server
    - `AMQP_PASSWORD`: Password of the user provided by `AMQP_USER`
    - `AMQP_VHOST`: (default: `/`)
    - `AMQP_PROTOCOL`: Protocol for the connection (default: `amqp`)
    - `AMQP_MANAGEMENT_API_PROTOCOL` (default: `http:`);
    - `AMQP_MANAGEMENT_API_HOST` (default: `AMQP_HOSTNAME`);
    - `AMQP_MANAGEMENT_API_PORT` (default: `15672`);
    - `AMQP_MANAGEMENT_USER` (eg: `AMQP_USER`);
    - `AMQP_MANAGEMENT_PASSWORD` (eg: `AMQP_PASSWORD`);
    - `PROJECT_MAIL_ADDRESS`: *[Optional]* Mail Address for contacting the project owner (used by VAPID)
    - `VAPID_PUBLIC_KEY`: *[Optional]* Public VAPID key for web push notifications
    - `VAPID_PRIVATE_KEY`: *[Optional]* Private VAPID key for web push notifications
    - `ARSNOVA_CLICK_BACKEND_BASE_PATH`: *[Optional]* Sets the path relative to the working directory which contains the app
    - `ARSNOVA_CLICK_BACKEND_PORT_EXTERNAL`: *[Optional]* This is the external port used for rewriting the urls of cached quizzes (default: `ARSNOVA_CLICK_BACKEND_PORT_INTERNAL`)
    - `ARSNOVA_CLICK_BACKEND_PORT_INTERNAL`: *[Optional]* This is the internal port used during the startup of the server (default: 3010)
    - `ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX`: *[Optional]* The routePrefix is used to prefix the access of the Express routes. E.g if set to 'backend' the access to '/api/v1/myPath' will become '/backend/api/v1/myPath'  (default: `/`)
    - `ARSNOVA_CLICK_BACKEND_REWRITE_ASSET_CACHE_URL`: *[Optional]* This configuration is used as base endpoint for cached assets  (default: `http://${hostname()}:${ARSNOVA_CLICK_BACKEND_PORT_INTERNAL}${ARSNOVA_CLICK_BACKEND_ROUTE_PREFIX}`)
    - `LEADERBOARD_ALGORITHM [PointBased | TimeBased]`: *[Optional]* Sets the leaderboard algorithm which should be used (default: `TimeBased`)
- mongo.env - Environment variables for bootstrapping the mongodb server
    - `MONGO_INITDB_DATABASE`: Name of the initial database (default: `arsnova-click-v2`)
    - `MONGO_INITDB_ROOT_USERNAME`: Initial root user name
    - `MONGO_INITDB_ROOT_PASSWORD`: Password of the user provided by `MONGO_INITDB_ROOT_USERNAME`
- init-mongo.js - Initial MongoDB cli commands for bootstrapping the server (eg. create db user, database, insert default documents, ...)
- rabbitmq.env - Environment variables for bootstrapping the rabbitmq server
    - eg: [List of some commands someone posted at github](https://github.com/docker-library/rabbitmq/issues/138#issuecomment-350081900)
    - Note that the default login of the rabbitmq docker image is `user:bitnami`
- rabbitmq-plugins.txt - Textfile containing the plugin list for rabbitmq (The dot at the end is mandatory!)

###### Build & Run
Just running `docker-compose up` should be everything required to run the server with its dependencies.
Note that the rabbitmq server is up approx. 1 minute after starting the container. The node app and the mongo db
are likely faster online. The node server tries to connect every 60 seconds to the rabbitmq so be patient if
the connection fails when starting the app.

###### Test
Enter `npm test` in the root directory to run the unit tests.
Note that since is uses a TypeScript runner for Mocha it is not required to build the server app before testing it.
Thus, the server gets started up during the test so the specified port must be available.
Currently the routing and the quiz export is covered by the tests.
The export unit test will generate a random filled Excel export file in the `${rootDir}/test-generated` folder.

###### Code style analysis
For a local code style analysis with docker-compose you'll need docker and docker-compose installed.
To run a local code style check with sonarqube, follow these steps:
1. switch into the analysis folder  
  `cd analysis`
2. start the sonarqube server  
  `docker-compose up -d sonarqube`
3. when sonarqube has started, you may run analysis whenever you want with  
  `docker-compose run --rm analysis`


###### Build (DEV)
Enter `npm run build:DEV` in the root directory to run the dev build.

###### Build (PROD)
Enter `npm run build:PROD` in the root directory to run the prod build.

###### Database migrations
Db Migrations are performed when the application starts. However, they can also be triggered manually.
Run `npm i -g migrate-mongo` and `cd` into the `db-migration` folder.
Then run `migrate-mongo up` to perform the pending migrations.
Use `migrate-mongo create [description]` to add a new migration.

- Required env variables:
    - `MONGODB_DB_MIGRATION_CONN_URL`, eg `mongodb://user:pass@localhost:27017`
    - `MONGODB_DB_NAME`, eg `arsnova-click-v2`

For more information check the [migrate-mongo](https://www.npmjs.com/package/migrate-mongo) library on npmjs.com
