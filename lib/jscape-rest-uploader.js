'use strict';

var HTTP           = require('request');
var Q              = require('q');
var stream         = require('stream');
var fs             = require('fs');
var progressStream = require('progress-stream');

/*
function JscapeRestUploader(host, username, password, authDomain) {
  this.host       = host.replace(/\/$/, ''); // remove trailing slash
  this.authDomain = authDomain;
  this.username   = username;
  this.password   = password;
  this.cookieJar  = HTTP.jar();// cookie jar for auth token. Note, unique per instance
};
*/

var Config = {
  debug:                  true,
  rejectUnauthorized:     true,
  uploadChunkSize:        1024 * 100,// 5 megabytes
};
// require('request').debug = true;

require('request-debug')(HTTP);

class JscapeRestUploader {
  
  constructor(host, username, password, authDomain) {
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

    return this.makeRequest('/rest/login', 'post', payload);
  }


  listFiles(path) {
    var url = ['/rest/files/list', {path: path} ];
    return this.makeRequest(url, 'get', null);
  }

  fileInfo(path) {
    var url = ['/rest/files/info', {path: path} ];
    return this.makeRequest(url, 'get', null);
  }

  
  upload(localFilepath, targetDirectory, newFilename) {
    var url = ['/rest/files', {path: targetDirectory, offset: 0}];
    return this.makeRequest(url, 'put', null);
  }

  uploadResumable(localFilepath, targetDirectory, targetFilename) {
    return Q.Promise((resolve, failure, progress) => {
      var upload = new ChunkedRestUpload(this, {
        localFilepath: localFilepath,
        targetDirectory: targetDirectory,
        targetFilename: targetFilename
      })


      upload.send().then(resolve, failure, progress);
    });
  }

  
  // putFileRequest(localFilepath, targetDirectory, newFilename) {
  //   var self = this;
  //   return Q.Promise(function () {
      
  //   });
    
  //   var stat = fs.statSync(localFilepath);
  //   var str = progressStream({
  //     length:      stat.size,
  //     transferred: 0,
  //     time:        100// Update interval
  //   });
    
  //   var fileStream  = fs.createReadStream(localFilepath);
  //   var passThrough = new stream.PassThrough();
  //   fileStream.pipe(str).pipe(passThrough);
    
  //   var options = {
  //     url: '/rest/files',
  //     qs: {directory: targetDirectory, offset: 0 },
  //     baseUrl: this.host,
  //     jar:     this.cookieJar,
  //     headers: {
  //       "Accept":       "application/json",
  //     },
  //     rejectUnauthorized: JscapeRestUploader.rejectUnauthorized,
      
  //     formData: {
  //       data: {
  //         value:  passThrough,
  //         options: {
  //           filename:    newFilename,
  //           contentType: 'application/octet-stream',
  //           knownLength: stat.size
  //         }
  //       }
  //     }
  //   };
    
  //   return Q.Promise(function (resolve, failure) {
  //     console.log("starting upload..");
  //     str.on('progress', function(progress) {
  //       console.log(progress);
  //     });

  //     // Start request
  //     HTTP.put(options, function (error, response, body) {
  //       console.log("error=", error);
  //       console.log("status=", response.statusCode);
  //     });
  //   });
    
  // }

  // url can be a string or an array where first element is url and second
  // a hash that will be turned into the query string.
  makeRequest(url, method, payload) {
    var self = this;
    var options = {
      baseUrl: this.host,
      jar:     this.cookieJar,
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
  
}// end class


class ChunkedRestUpload {
  constructor(uploader, uploadSettings) {
    this.uploader       = uploader;
    this.uploadSettings = uploadSettings;

    this.totalChunks    = null;
    this.currentChunk   = 0;

    this.isReady        = false;
  }

  send() {
    return Q.Promise((resolve, failure, progress)  => {
      this.whenReady(() => {
        try{
          this.sendAllChunks(resolve, failure, progress);
        }catch(e){
          failure(e);
        }
      }, failure).catch(failure);
    });
  }
  
  whenReady(callback, failure) {
    if (this.isReady){
      callback();
      return Promise.resolve();
    } else {
      console.log("not rady. getting info");
      // go get file info first.
      var rsvp = this.getFileInfo()
      rsvp.then( () => {
        callback(this);
      }, failure);
      return rsvp;
    }
  }

  getFileInfo(){
    var self  = this;
    return Q.Promise( (resolve, failure) => {
      var uploadSize = this.fileSize();
      console.log("this.uploadSettings=", this.uploadSettings);
      var targetFile = this.uploadSettings.targetDirectory.replace(/\/$/,'') + '/' + this.uploadSettings.targetFilename;


      console.log("upload size, chunk size = ", uploadSize, Config.uploadChunkSize);
      
      // See if part of the file has already been uploaded.
      // remove trailing slash if present.
      this.uploader.fileInfo(targetFile).then( (info) => {
        this.totalChunks  = Math.ceil(uploadSize / Config.uploadChunkSize);
        this.currentChunk = Math.floor(info.size / Config.uploadChunkSize);
        this.isReady = true;
        console.log("current chunk = ", this.currentChunk);
        resolve();
        
      }, failure).catch(failure);
    });
  }

  
  fileSize(){
    if (this.uploadSettings.buffer){
      return this.uploadSettings.buffer.length;
      
    } else if (this.uploadSettings.localFilepath ){
      return fs.statSync(this.uploadSettings.localFilepath).size;
    } else {
      return null;
    }
  }
  
  raiseIfNotReady() {
    if(!this.isReady){
      console.log("not ready");
      throw "ChunkedRestUpload is not ready.";
    }
  }
  
  currentOffset(){
    this.raiseIfNotReady();
    return this.currentChunk * Config.uploadChunkSize;
  }

  makeChunkProgressStream(progressCallback) {
    this.raiseIfNotReady();
    
    var tracker = progressStream({
      length:      this.fileSize(),
      transferred: this.currentChunk * Config.uploadChunkSize,
      time:        100// Update interval
    });
    
    //console.log("size, transfered", ((this.currentChunk * Config.uploadChunkSize) /this.fileSize() ),this.fileSize(), this.currentChunk * Config.uploadChunkSize);
    //tracker.on('progress', progressCallback);
    tracker.on('progress', function (p) {
      console.log("p2=", p);
    });
    
    var fileStream  = fs.createReadStream(this.uploadSettings.localFilepath, {
      start: this.currentOffset(),
      end:   this.currentOffset() + Config.uploadChunkSize
    });

    fileStream.on('data', function (chunk) {
      console.log("data!", chunk.length);
    });

    //return fileStream;
    
    var passThrough = new stream.PassThrough();// this makes the tracker work
    return fileStream.pipe(tracker).pipe(passThrough);
    //return tracker;
    //return passThrough;
  }

  // makes many calls the sendCurrentChunk
  // and calls resolve function when done.
  sendAllChunks(resolve, failure, progress){
    console.log("Chunk, c/t",  this.currentChunk, this.totalChunks);
    if(this.currentChunk < this.totalChunks){
      this.sendCurrentChunk().then( () => {
        console.log("===================== next chunk.... =================");
        this.sendAllChunks(resolve, failure, progress);
      }, failure, progress).catch(failure);
    }else {
      resolve();
    }
  }

  // makes http request to send current chunk
  // returns Promise
  sendCurrentChunk() {
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
      
      formData: {
        data: {
          value: null,// We will set this to the stream/buffer later
          options: {
            filename:    this.uploadSettings.targetFilename,
            contentType: 'application/octet-stream',
            knownLength: Math.min(Config.uploadChunkSize, this.fileSize() - this.currentOffset())
          }
        }
      }
    };
    
    return Q.Promise( (resolve, failure, progress) => {
      
      if (this.uploadSettings.buffer){
        console.log("sending buffer");
        // No progress buffers... sorry. Look for how to convert a buffer to a stream though.
        options.formData.data.value = this.uploadSettings.buffer.slice(
          this.currentOffset(),
          this.currentOffset() + Config.uploadChunkSize
        );
      } else {
        console.log("making chunk stream");
        var stream = this.makeChunkProgressStream(progress);
        options.formData.data.value = stream;
      }
      
      console.log("starting upload of chunk, offset=", this.currentChunk, this.currentOffset());
      
      // Start request
      HTTP.put(options, (error, response, body) => {
        console.log("put done..");
        console.log("error=", error);
        console.log("status=", response.statusCode);
        
        if (error || Math.floor(response.statusCode / 100) != 2) {
          failure(error);
        } else {
          this.currentChunk++;
          resolve();
        }
      }, failure);

    });
    
  }// end sendCurrentChunk fn
  
}


JscapeRestUploader.Config = Config;

module.exports = JscapeRestUploader;


/*  

  uploadFile: function(filePath) {
    // post JSON
    var loginData = {
        domain:   ftpDomain,
        username: ftpUser,
        password: ftpPassword
    };

    var request = rest.json(
      ftpHostLogin,
      loginData,
      {
        rejectUnauthorized: false,
        headers: {
          "Accept": "application/json",
          //"Content-type": "application/json",
        }
      },
      "POST"
    );

    request.on('complete', function(data, response) {
      // handle response
      // console.log('response.headers=', response.headers);
      var cookieString = response.headers["set-cookie"];
      var sessionId = cookieString[0].match(/JSESSIONID=([a-zA-Z0-9]+);/)[1];
      // console.log('sessionId=', sessionId);

      if (response.statusCode !== 204) {
        console.log('FAILED response =', Object.keys(response.raw));
        return;
      }

      rest.put(ftpDestination, {
        multipart: true,
        rejectUnauthorized: false,
        headers: {
          "Cookie": "JSESSIONID=" + sessionId,
          "Accept": "application/json",
        },
        data: {
          // path: '/',
          // offset: 0,
          // compressed: false,
          //File(path, filename, fileSize, encoding, contentType) {
          data: rest.file(filePath)//, 'test-data.txt', 16, "ascii", 'text/plain')
        }
      }).on('complete', function(data, response) {
        // console.log("data =", data);
        console.log("REST PUT complete statusCode = ", response.statusCode);
      });
    });
  },
};
*/

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
