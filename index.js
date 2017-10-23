// Entry point of the application calls the agent's
// fetchAndProcessAllPullRequests function
const Agent = require('./src/agent.js');
const credentials = require('./github-credentials.json');
const request = require('superagent');

const agent = new Agent(credentials);

request
  // CHANGE THE URL FOR THE URL OF YOUR OWN CONFIG FILE
  .get('https://dipietroa.github.io/generated_files/config.json')
  .auth(credentials.username, credentials.token)
  .set('Accept', 'text/plain')
  .end((err, result) => {
    const json = JSON.parse(result.text);
    const count = 0;
    agent.fetchAndProcessAllPullRequests(
      json[count].owner,
      json[count].repo,
      count + 1, json
    );
  });
