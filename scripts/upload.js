var _base = require('./_base');
var fs    = require('fs');

var localFilepath   = _base.args[0];
var targetDirectory = _base.args[1] || '/';
var newFilename     = _base.args[2] || localFilepath.split('/').reverse()[0];

_base.uploader.login().then(function () {
  console.log(`Uploading ${localFilepath} to ${targetDirectory}/${newFilename}`);
  
  var x = _base.uploader.uploadResumable(localFilepath, targetDirectory, newFilename).then(
    () => {console.log("COMPLETED");},
    function(e) {console.log("FAILURE:", e);},
    function(p) {
      console.log(Math.round(p.percentage * 1000)/ 10 + `%\t${p.transferred} / ${p.length}`);
    }
  );
  
}, function (error) {
  console.log("Error: ", error);
}).catch(function(e){
  console.log("Exception: ", e);
});
