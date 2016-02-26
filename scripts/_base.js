var JscapeRestUploader = require('../lib/jscape-rest-uploader');
var secrets            = require('./secrets.js');

JscapeRestUploader.rejectUnauthorized = false;
var uploader = new JscapeRestUploader(
  secrets.host,
  secrets.username,
  secrets.password,
  secrets.domain
);

// clone and remove node and filename as args
var args = process.argv.slice(0);
args.shift();
args.shift();


module.exports = {
  args: args,
  uploader: uploader
};


