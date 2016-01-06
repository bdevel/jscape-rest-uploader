'use strict';

var Config              = require('./config');
var SegmentedRestUpload = require('./segmented-rest-upload');

var HTTP = require('request');
var Q    = require('q');

if (Config.debug){
  require('request').debug = true;
  require('request-debug')(HTTP);
}
  
class JscapeRestUploader {
  
  constructor(host, username, password, authDomain) {
    if (host === undefined || username  === undefined || password === undefined){
      throw new Error("Login details not specified");
    }
    this.host       = host.replace(/\/$/, ''); // remove trailing slash
    this.authDomain = authDomain;
    this.username   = username;
    this.password   = password;
    this.cookieJar  = HTTP.jar();// cookie jar for auth token. Note, unique per instance
  }
  
  login() {
    var payload = {
      domain:   this.authDomain,
      username: this.username,
      password: this.password
    };
    
    return this.jsonPost('/rest/login', payload);
  }


  listFiles(path) {
    var url = ['/rest/files/list', {path: path} ];
    return this.jsonGet(url);
  }

  fileInfo(path) {
    var url = ['/rest/files/info', {path: path} ];
    return this.jsonGet(url);
  }

  md5(path) {
    var url = ['/rest/files/hash', {path: path} ];
    return this.jsonPost(url);
  }
  
  deleteFile(path) {
    var url = ['/rest/files', {path: path}];
    return this.makeRequest(url, 'del', {});
  }
  
  uploadResumable(localFilepath, targetDirectory, targetFilename) {
    return Q.Promise((resolve, failure, progress) => {
      var upload = new SegmentedRestUpload(this, {
        localFilepath: localFilepath,
        targetDirectory: targetDirectory,
        targetFilename: targetFilename
      })
      
      upload.send().then(resolve, failure, progress);
    });
  }

  // Send a buffer instead of a file path. Usefull for sending
  // up say, a json file without writing to the local disk.
  uploadBuffer(buffer, targetDirectory, targetFilename) {
    return Q.Promise((resolve, failure, progress) => {
      var upload = new SegmentedRestUpload(this, {
        buffer:          buffer,
        targetDirectory: targetDirectory,
        targetFilename:  targetFilename
      });
      
      upload.send().then(resolve, failure, progress);
    });
  }

  // Post up JSON
  jsonPost(url, payload) {
    return this.makeRequest(url, 'post', payload);
  }

  // Get json
  jsonGet(url) {
    return this.makeRequest(url, 'get');
  }
  
  
  // url can be a string or an array where first element is url and second
  // a hash that will be turned into the query string.
  makeRequest(url, method, payload) {
    var self = this;
    var options = {
      baseUrl: this.host,
      jar:     this.cookieJar,
      forever:   true,// keep-alive. improves speed by quite a bit.
      headers: {
        "Accept":       "application/json",
        "Content-type": "application/json"
      },
      rejectUnauthorized: JscapeRestUploader.rejectUnauthorized
    };
    
    if (typeof url == 'string'){
      options.url = url;
    } else{
      options.url = url[0];
      options.qs  = url[1];
    }
    
    if (payload){
      options.body = JSON.stringify(payload);
    }

    return Q.Promise(function (resolve, failure) {
      // Start request
      HTTP[method](options, function (error, response, body) {
        // automaticly login if auth has failed/expired
        if (response.statusCode == 401 && options.url.match(/rest\/login/) === null) {
          self.login().then(function () {
            // retry request
            self.makeRequest(url, method, payload)
              .then(resolve, failure)
              .catch(failure);
          }, failure).catch(failure);
          return;
        }

        // try to parse the body as JSON.
        var jsonBody = {};
        try {jsonBody = JSON.parse(body);} catch(e){}
        
        // If error or not 200 code
        if (error || Math.floor(response.statusCode / 100) != 2) {
          failure(error);
        } else {
          resolve(jsonBody);
        }
        
      });// end HTTP
    });// end Promise
    
   }// end makeRequest


  makeFilePutRequest(data, targetDirectory, targetFilename) {
    this.raiseIfNotReady();
    var options = {
      baseUrl: this.uploader.host,
      url: '/rest/files',
      qs: {
        directory: this.uploadSettings.targetDirectory,
        offset:    this.currentOffset(),
      },
      jar:         this.uploader.cookieJar,
      headers: {
        "Accept":       "application/json",
      },
      rejectUnauthorized: Config.rejectUnauthorized,
      // TODO: Add compression
      forever:   true,// keep-alive. improves speed by quite a bit.
      formData: {
        data: {
          value: this.makeDataStream(),
          options: {
            filename:    this.uploadSettings.targetFilename,
            contentType: 'application/octet-stream',
            knownLength: Math.min(Config.uploadSegmentSize, this.fileSize() - this.currentOffset())
          }
        }
      }
    };
    
    return Q.Promise( (resolve, failure, progressCallback) => {
      // Start request
      HTTP.put(options, (error, response, body) => {
        if (error || Math.floor(response.statusCode / 100) != 2) {
          failure(error);
        } else {
          this.currentSegment++;
          this.sendProgress(progressCallback);
          resolve();
        }
      }, failure);

    });
    
  }// end sendCurrentSegment fn

  
}// end class


JscapeRestUploader.Config = Config;
module.exports = JscapeRestUploader;


// Docs: http://ftp.example.com/doc/api/
//
// # Auth via REST
// curl -X POST \
//      -c "$cookie_file" \
//      -H "Accept: application/json" \
//      -H "Content-type: application/json" \
//      -d "{\"domain\": \"$domain\", \"username\": \"$username\", \"password\": \"$password\"} " \
//       --verbose \
//       http://ftp.example.com/rest/login
//
// # Upload file via multipart. Body is content of file. -b is cookie value.
// curl -X PUT \
//      -b "JSESSIONID=`get_session_id`" \
//      -H "Accept: application/json" \
//      -F "body=@/Users/name/test.txt" \
//      --verbose \
//      'http://ftp.example.com/rest/files?path=/incoming/test.txt"&offset=0&compressed=false'
