
# jscape-rest-uploader



```javascipt
var JscapeRestUploader = require('jscape-rest-uploader');
var uploader = new JscapeRestUploader(
  'ftp.example.com',
  'username',
  'secretPassword',
  'your-auth-domain'
);

// Get files in the root. Automaticly login if not authenticated
// Each instance of JscapeRestUploader has it's own auth cookie jar.
uploader.listFiles('/').then(function (list, response) {
  console.log("status: ", response.statusCode);
  list.forEach(function (file) {
    console.log("path: ",                 file.path);
    console.log("name: ",                 file.name);
    console.log("type: ",                 file.type);
    console.log("readable: ",             file.readable);
    console.log("writable: ",             file.writable);
    console.log("size: ",                 file.size);
    console.log("lastModificationDate: ", file.lastModificationDate);
  });
});

````


## Uploads

```javascript
// You can also login, wait, then upload
uploader.login().then(function () {
  uploader.uploadResumable(localFilepath, targetDirectory, newFilename).then(
    () => {console.log("COMPLETED");},
    function(e) {console.log("FAILURE:", e);},
    function(p) {
      console.log(Math.round(p.percent * 1000)/ 10 + `%\t${p.sent} / ${p.total}`);
    }
  );  
}, function (error) {

});

```

Resumable uploads cut the file into several segments that are sent
by the same number of PUT requests to the server so that
if the connection fails, the user doesn't have to start the upload from
zero. By default the chunk size is 10MB but you can configure that if
your users have a slow connections or using really big files files.

The code will look for a file with the same name as
`targetFilename` inside `targetDirectory`. Care should be taken so that you don't have collisions
with pre-existing files.

## Configuration

* __Skip SSL validation errors:__ `JscapeRestUploader.Config.rejectUnauthorized = false;`
* __Set uploadResumable segment size:__ `JscapeRestUploader.Config.uploadSegmentSize = 1024 * 1024 * 5;// 5MB`



## Scripts

* **Directory listing:** With npm, `npm run-script ls / -l` or with node, `node scripts/ls.js /remote-dir`
* **Upload file:** `npm run-script upload photo.jpg /destination`
* **Delete file:** `npm run-script delete /destination/photo.jpg`

These scripts will authenticate by looking for a `secrets.js` file that looks like this:

```javascript
module.exports = {
  host:     'https://ftp.example.com/',
  username: 'jimmy',
  password: 'secret',
  domain:   'Acme Inc.'
}
```

You can change your shell NODE_PATH to include the directory where secrets.js can be found:

```sh
export NODE_PATH=".:./config"
```

### Test files
To make a dummy test file to upload try `openssl rand -out dummy-md.pcap -base64 $((250000000 * 3/4))` to make a 250MB file.
