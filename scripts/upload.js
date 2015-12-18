var _base = require('./_base');

require('request').debug = true;

var localFilepath   = '/Users/tyler/Code/jscape-rest-upload/dummy.pcap';
//var localFilepath   = '/Users/tyler/Code/jscape-rest-upload/dummy-small.pcap';
var targetDirectory = '/';
var newFilename     = 'dummy.pcap';

_base.uploader.login().then(function () {
  _base.uploader.putFileRequest(localFilepath, targetDirectory, newFilename);
  

  
}, function (error) {
  console.log("Error: ", error);
}).catch(function(e){
  console.log("Exception: ", e);
});


console.log("Done!");
