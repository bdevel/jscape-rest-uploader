'use strict';

var Config = require('./config')
var HTTP   = require('request');
var Q      = require('q');
var fs     = require('fs');
var progressStream = require('progress-stream');

class SegmentedRestUpload {
  constructor(uploader, uploadSettings) {
    this.uploader       = uploader;
    this.uploadSettings = uploadSettings;
    
    this.currentSegment   = 0;
    this.totalSegments  = Math.ceil(this.fileSize() / Config.uploadSegmentSize);
    
    this.isReady        = false;
  }
  
  // Start uploading the file in segments.
  send() {
    return Q.Promise((resolve, failure, progress)  => {
      this.whenReady(() => {
        try{
          this.progressCallback = progress;
          this.sendAllSegments(resolve, failure);
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
      // remove trailing slash if present.
      var targetFile = this.uploadSettings.targetDirectory.replace(/\/$/,'') + '/' + this.uploadSettings.targetFilename;

      // See if part of the file has already been uploaded.
      this.uploader.fileInfo(targetFile).then( (info) => {
        this.currentSegment = Math.floor(info.size / Config.uploadSegmentSize);
        this.isReady      = true;
        resolve();
      }, (error) => {
        if (error === null){
          // File not found
          this.currentSegment = 0;
          this.isReady      = true;
          resolve();
        } else {
          failure(error);
        }
      }).catch(failure);
    });
  }
  
  fileSize(){
    if (this.uploadSettings.buffer){
      return this.uploadSettings.buffer.length;
    } else if (this.uploadSettings.localFilepath ){
      return fs.statSync(this.uploadSettings.localFilepath).size
    } else {
      throw "Cannot determine file size.";
    }
  }
  
  raiseIfNotReady() {
    if(!this.isReady){
      throw "SegmentedRestUpload is not ready.";
    }
  }
  
  currentOffset(){
    this.raiseIfNotReady();
    return Math.min(this.currentSegment * Config.uploadSegmentSize, this.fileSize());
  }

  addProgressTracker(toTrack){
    var counter = progressStream({
      length:      this.fileSize(),
      transferred: this.currentOffset(),
      time: 100// update interval
    });
    
    if (this.progressCallback){
      counter.on('progress', (p) => {
        if (p.remaining != 0 && p.percentage === 100) {
          // Skip if we haven't reached the end of the full file
          // progress-stream will send 100% when EOF for that small segment
        } else{
          this.progressCallback(p);
        }
      });
    }
    
    toTrack.pipe(counter);
    return counter;
  }
  
  makeDataStream() {    
    this.raiseIfNotReady();
    
    if (this.uploadSettings.buffer){
      return this.uploadSettings.buffer.slice(
        this.currentOffset(),
        this.currentOffset() + Config.uploadSegmentSize
      );
    } else {
      var dataStream = fs.createReadStream(this.uploadSettings.localFilepath, {
        start: this.currentOffset(),
        end:   this.currentOffset() + Config.uploadSegmentSize
      });
      return this.addProgressTracker(dataStream);
    }
    
  }

  // Makes many calls the sendCurrentSegment
  // and calls resolve function when done.
  sendAllSegments(resolve, failure){
    if(this.currentOffset() < this.fileSize() ){
      this.sendCurrentSegment().then( () => {
        // TODO: Add pause function, exit here if paused
        this.sendAllSegments(resolve, failure);
        
      }, failure).catch(failure);
    }else {
      resolve();
    }
  }

  // makes http request to send current segment
  // returns Promise
  sendCurrentSegment() {
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
    
    return Q.Promise( (resolve, failure) => {
      // Start request
      HTTP.put(options, (error, response, body) => {
        if (error || Math.floor(response.statusCode / 100) != 2) {
          failure(`Bad status of ${response.statusCode}: ${error}`);
        } else {
          this.currentSegment++;
          resolve();
        }
      }, failure);

    });
    
  }// end sendCurrentSegment fn
  
}


module.exports = SegmentedRestUpload;
