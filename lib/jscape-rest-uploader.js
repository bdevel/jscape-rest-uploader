var HTTP     = require('request');
var stream   = require('stream');
var fs       = require('fs');
var progress = require('progress-stream');

function JscapeRestUploader(host, username, password, authDomain) {
  this.host       = host.replace(/\/$/, ''); // remove trailing slash
  this.authDomain = authDomain;
  this.username   = username;
  this.password   = password;
  this.cookieJar  = HTTP.jar();// cookie jar for auth token. Note, unique per instance
};


JscapeRestUploader.rejectUnauthorized = true;// Set to false to ignore SSL cert errors
JscapeRestUploader.uploadChunkSize    = 1024 * 50;// 50 megabytes


JscapeRestUploader.prototype.login = function () {
  var payload = {
    domain:   this.authDomain,
    username: this.username,
    password: this.password
  };

  return this.makeRequest('/rest/login', 'post', payload);
  
};


JscapeRestUploader.prototype.listFiles = function (path) {
  var url = ['/rest/files/list', {path: path} ];
  return this.makeRequest(url, 'get', null);
};

JscapeRestUploader.prototype.fileInfo = function (path) {
  var url = ['/rest/files/info', {path: path} ];
  return this.makeRequest(url, 'get', null);
};


JscapeRestUploader.prototype.upload = function (localFilepath, targetDirectory, newFilename) {
  var url = ['/rest/files', {path: targetDirectory, offset: 0}];
  return this.makeRequest(url, 'put', null);
};


JscapeRestUploader.prototype.uploadResumable = function (localFilepath, targetDirectory, newFilename) {
  return new Promise(function (resolve, failure, progress) {
    // See if part of the file has already been uploaded.
    // remove trailing slash if present.
    this.fileInfo(targetDirectory.replace(/\/$/,'') + '/' + newFilename).then(function (info) {
      var stat         = fs.statSync(localFilepath);
      var totalChunks  = Math.ceil(stat.size / JscapeRestUploader.uploadChunkSize);
      var currentChunk = Math.floor(info.size / JscapeRestUploader.uploadChunkSize);

      // If already uploaded, just resolve
      if (stat.size === info.size){
        resolve();
        return;
      }

      transferChunk(localFilepath).then(function () {
      });
      
    }, failure).catch(failure);
  });
};


JscapeRestUploader.prototype.putFileRequest = function(localFilepath, targetDirectory, newFilename) {
  var self = this;
  return new Promise(function () {
    
  });
  
  var stat = fs.statSync(localFilepath);
  var str = progress({
    length:      stat.size,
    transferred: 0,
    time:        100// Update interval
  });
  
  
  var fileStream  = fs.createReadStream(localFilepath);
  var passThrough = new stream.PassThrough();
  fileStream.pipe(str).pipe(passThrough);
  
  var options = {
    url: '/rest/files',
    qs: {directory: targetDirectory, offset: 0 },
    baseUrl: this.host,
    jar:     this.cookieJar,
    headers: {
      "Accept":       "application/json",
    },
    rejectUnauthorized: JscapeRestUploader.rejectUnauthorized,
    
    formData: {
      data: {
        value:  passThrough,
        options: {
          filename:    newFilename,
          contentType: 'application/octet-stream',
          knownLength: stat.size
        }
      }
    }
  };
  
  return new Promise(function (resolve, failure) {
    console.log("starting upload..");
    str.on('progress', function(progress) {
      console.log(progress);
    });

    // Start request
    HTTP.put(options, function (error, response, body) {
      console.log("error=", error);
      console.log("status=", response.statusCode);
    });
  });
  
};



// url can be a string or an array where first element is url and second
// a hash that will be turned into the query string.
JscapeRestUploader.prototype.makeRequest = function (url, method, payload) {
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

  return new Promise(function (resolve, failure) {
    // Start request
    HTTP[method](options, function (error, response, body) {
      //console.log("status:", response.statusCode);
      
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
    
};// end makeRequest



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
