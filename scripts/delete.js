var _base = require('./_base');
var fs    = require('fs');

var filepath   = _base.args[0];

_base.uploader.login().then(function () {
  console.log(`Deleting ${filepath}`);
  
  var x = _base.uploader.deleteFile(filepath).then(
    () => {console.log("COMPLETED");},
    function(e) {console.log("FAILURE:", e);},
    function(p) {
    }
  );
  
}, function (error) {
  console.log("Error: ", error);
}).catch(function(e){
  console.log("Exception: ", e);
});
