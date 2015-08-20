# trailapp-backend

## Deploying to Elastic Beanstalk

Run 'eb init' to start a new Elastic Beanstalk environment. Specify the following preferences during initialisation:

ApplicationName=trailapp-backend
EnvironmentName=trailapp-backend-env
EnvironmentTier=WebServer::Standard::1.0
EnvironmentType=LoadBalanced
RdsEnabled=No
SolutionStack=64bit Amazon Linux 2014.09 v1.1.0 running Node.js

To start the environment, run 'eb start'. To deploy the latest git commit, run 'git aws.push'. If you receive 502 Bad Gateway errors when you visit the application endpoint, you may need to change the 'Node command' option in Configuration > Software Configuration in the Elastic Beanstalk web console to the value 'npm start'. If you still get 502s after this, examine the logs to debug.

## Usage

TODO: Write usage instructions
