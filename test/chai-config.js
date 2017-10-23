const chai = require('chai');
const dirty = require('dirty-chai');

const should = chai.should();
chai.use(dirty);

module.exports = should;
