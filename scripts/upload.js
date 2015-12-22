var _base = require('./_base');

var localFilepath   = '/Users/tyler/Code/jscape-rest-uploader/dummy.pcap';
//var localFilepath   = '/Users/tyler/Code/jscape-rest-upload/dummy-small.pcap';
var targetDirectory = '/';
var newFilename     = 'dummy.pcap';

_base.uploader.login().then(function () {
  console.log("Starting upload function");
  var x = _base.uploader.uploadResumable(localFilepath, targetDirectory, newFilename).then(
    () => {console.log("success");},
    function(e) {console.log("fail", e);},
    function(p) {console.log("progress=", p);}
  );
  
}, function (error) {
  console.log("Error: ", error);
}).catch(function(e){
  console.log("Exception: ", e);
});


console.log("Done!");
