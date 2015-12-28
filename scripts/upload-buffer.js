var _base = require('./_base');

var targetDirectory = _base.args[0];
var newFilename     = _base.args[1];


var content = '';
process.stdin.resume();
process.stdin.on('data', function(buf) { content += buf.toString(); });
process.stdin.on('end', function() {
  
  _base.uploader.login().then(function () {
    console.log(`Uploading ${content.length} bytes to ${targetDirectory}/${newFilename}`);
    
    var x = _base.uploader.uploadBuffer(content, targetDirectory, newFilename).then(
      () => {console.log("COMPLETED");},
      function(e) {console.log("FAILURE:", e);},
      function(p) {
        console.log(Math.round(p.percent * 1000)/ 10 + `%\t${p.sent} / ${p.total}`);
      }
    );
    
  }, function (error) {
    console.log("Error: ", error);
  }).catch(function(e){
    console.log("Exception: ", e);
  });
  
  
});


// console.log("string=", string);
// exit();

