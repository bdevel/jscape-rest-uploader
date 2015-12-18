var JscapeRestUploader = require('lib/jscape-rest-uploader');
var secrets = require('./secrets');

var uploader = new JscapeRestUploader(
  secrets.ftpHost,
  secrets.ftpDomain,
  secrets.ftpUser,
  secrets.ftpPassword
);

JscapeRestUploader.rejectUnauthorized = false;


uploader.listFiles('/').then(function (list) {
  list.slice(0,3).forEach(function (file) {
    uploader.fileInfo(file.path).then(function (info) {
      console.log("Path: ", file.path);
      console.log("info =", info);
      console.log("--------------------------\n\n");
    });
  });
  
}, function (error) {
  console.log("error:", error);
}).catch(function (error) {
  console.log("Exception: ", error);
});


