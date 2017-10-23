const request = require('superagent');
const Storage = require('./storage.js');
const Throttle = require('superagent-throttle');

/**
 * Agent class
 */
class Agent {
  /**
   * Constructor
   * @param {*} credentials
   */
  constructor(credentials) {
    this.credentials = credentials;
  }

  /**
   * Fetch all the pull request data from the GitHub API
   * @param {*} owner
   * @param {*} repo
   * @param {*} next
   * @param {*} json
   * @param {*} allPullRequestsAreAvailable
   */
  fetchAndProcessAllPullRequests(owner, repo, next, json) {
    let target = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all`;
    let pullRequests = [];
    // CHANGE THE DEST REPO FOR YOUR OWN REPOSITORY
    const destRepo = 'dipietroa.github.io';

    /**
     * Return an object representing the number of PR for each month
     * @param {*} jsonData
     */
    function getFrequencyDate(jsonData) {
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

      const occurs = { };

      for (let i = 0; i < jsonData.length; i += 1) {
        const curDate = new Date(jsonData[i].createdAt);
        const formatDate = `${monthNames[curDate.getMonth()]}-${curDate.getFullYear()}`;
        if (!occurs[formatDate]) {
          occurs[formatDate] = { total: 0, merged: 0 };
        }
        occurs[formatDate].total += 1;
        if (jsonData[i].mergedAt != null) {
          occurs[formatDate].merged += 1;
        }
      }
      return occurs;
    }

    /**
     * Return an object representing the number of PR by user
     * @param {*} jsonData
     */
    function getPRByUserInfos(jsonData) {
      const occurs = { };

      for (let i = 0; i < jsonData.length; i += 1) {
        if (!occurs[jsonData[i].username]) {
          occurs[jsonData[i].username] = { total: 0, merged: 0, avatarUrl: jsonData[i].avatarUrl };
        }
        occurs[jsonData[i].username].total += 1;

        if (jsonData[i].mergedAt != null) {
          occurs[jsonData[i].username].merged += 1;
        }
      }
      return occurs;
    }

    /**
     * Return an object that represents the user with best ratio
     * @param {*} jsonData
     */
    function getBestRatioUser(jsonData) {
      let bestRatio = 0;
      let username = 'nobody';
      let imagePath = '';
      Object.keys(jsonData).forEach((key) => {
        if ((jsonData[key].merged / jsonData[key].total) > bestRatio) {
          bestRatio = jsonData[key].merged / jsonData[key].total;
          imagePath = jsonData[key].avatarUrl;
          username = key;
        }
      });
      return { user: username, ratio: bestRatio, image: imagePath };
    }

    /**
     * Return an object that represents the user with highest number of PR
     * @param {*} jsonData
     */
    function getUserWithHighestPRNum(jsonData) {
      let highestPRNum = 0;
      let username = 'nobody';
      let imagePath = '';
      Object.keys(jsonData).forEach((key) => {
        if (jsonData[key].total > highestPRNum) {
          highestPRNum = jsonData[key].total;
          imagePath = jsonData[key].avatarUrl;
          username = key;
        }
      });
      return { user: username, nbPR: highestPRNum, image: imagePath };
    }

    /**
     * Return an object that represents the user with highest number of merged PR
     * @param {*} jsonData
     */
    function getUserWithHighestMerged(jsonData) {
      let highestMerged = 0;
      let username = 'nobody';
      let imagePath = '';
      Object.keys(jsonData).forEach((key) => {
        if (jsonData[key].merged > highestMerged) {
          highestMerged = jsonData[key].merged;
          imagePath = jsonData[key].avatarUrl;
          username = key;
        }
      });
      return { user: username, nbPR: highestMerged, image: imagePath };
    }

    /**
     * Function that creates the structure of the json file
     * @param {*} jsonData
     * @param {*} jowner
     * @param {*} jrepo
     */
    function formatResult(jsonData, jowner, jrepo) {
      const nbOfPullRequests = jsonData.length;
      let lastPullRequest = { createdAt: '', username: '' };
      let pullRequestByUserInfos = { };
      let nPRByDate = { };
      const lastFileUpdate = new Date();
      let bestRat = { };
      let highPR = { };
      let highM = { };

      // Check if the repository has pull requests
      if (nbOfPullRequests !== 0) {
        lastPullRequest = { createdAt: jsonData[0].createdAt, username: jsonData[0].username };
        pullRequestByUserInfos = getPRByUserInfos(jsonData);
        nPRByDate = getFrequencyDate(jsonData);
        bestRat = getBestRatioUser(pullRequestByUserInfos);
        highPR = getUserWithHighestPRNum(pullRequestByUserInfos);
        highM = getUserWithHighestMerged(pullRequestByUserInfos);
      }

      const result = {
        lastUpdate: lastFileUpdate,
        cowner: jowner,
        crepo: jrepo,
        totalPR: nbOfPullRequests,
        lastPR: lastPullRequest,
        bestPR: highPR,
        bestMerged: highM,
        bestRatio: bestRat,
        userPRInfos: pullRequestByUserInfos,
        datePRInfos: nPRByDate
      };

      return result;
    }

    /**
     * Fetch one page sent by the GitHub API
     * @param {*} pageUrl
     * @param {*} credentials
     * @param {*} index
     */
    function fetchAndProcessPage(pageUrl, credentials, index) {
      /**
       * Throttle regulates the stream of requests
       */
      const throttle = new Throttle({
        active: true, // set false to pause queue
        rate: 5, // how many requests can be sent every `ratePer`
        ratePer: 10000, // number of ms in which `rate` requests may be sent
        concurrent: 2 // how many requests can be sent concurrently
      });

      // Get json from GitHub API
      request
        .get(pageUrl)
        .use(throttle.plugin())
        .auth(credentials.username, credentials.token)
        .set('Accept', 'application/vnd.github.v3+json')
        .end((err, res) => {
          let curJsonStruct;
          if (!err) {
            res.body.forEach((element) => {
              // Temporary reduced json structure
              curJsonStruct = {
                username: element.user.login,
                avatarUrl: element.user.avatar_url,
                createdAt: element.created_at,
                mergedAt: element.merged_at,
                closedAt: element.closed_at
              };
              pullRequests = pullRequests.concat(curJsonStruct);
            });
            // When there's another page of PR for the current repository ->
            // fetching the next page
            if (res.links.next) {
              fetchAndProcessPage(res.links.next, credentials, index);
            } else {
              // Storing the file on GitHub
              const storage = new Storage(credentials.username, credentials.token, destRepo);
              storage.publish(`generated_files/${json[index - 1].owner}-${json[index - 1].repo}.json`, JSON.stringify(formatResult(pullRequests, json[index - 1].owner, json[index - 1].repo), null, 2), `new version of file ${json[index - 1].owner}-${json[index - 1].repo}`, (err) => {
                if (err) {
                  console.log(`Fail when updating ${json[index - 1].owner}-${json[index - 1].repo}.json`);
                }
                // Preparing the next repository to fetch
                if (index < json.length) {
                  pullRequests = [];
                  target = `https://api.github.com/repos/${json[index].owner}/${json[index].repo}/pulls?state=all`;
                  // Fetching first page of a new repository
                  fetchAndProcessPage(target, credentials, index + 1);
                }
              });
            }
          } else {
            console.log(`Fail on fetching a page ${pageUrl}, current repo update abort.`);
          }
        });
    }
    fetchAndProcessPage(target, this.credentials, next);
  }
}

module.exports = Agent;
