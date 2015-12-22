
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

// You can also login then get listing.
// Each instance of JscapeRestUploader has it's own auth cookie jar.
uploader.login().then(function () {
  
}, function (error) {

});

````


## Uploads

```javascript
uploader.putFile({
  localFilepath: 'asdf',
  buffer:        new Buffer('foo bar'),
  targetDirectory: '/',
  targetFilename: 'foo.txt'
});
```



Resumable uploads are split into several seperate PUT requests so that
if the connection fails the user doesn't have to start the upload from
zero. By default the chunk size is 50MB but you can configure that if
your users have a slow connnections or using small files.

The code will look for a file with the same name as
`targetFilename`. Care should be taken so that you don't have collisions
with pre-existing files.

## Configuration

* __Skip SSL validation errors:__ `JscapeRestUploader.Config.rejectUnauthorized = false;`
* __Set resumableUpload chunk size:__ `JscapeRestUploader.Config.uploadChunkSize = 1024 * 5;`



## Scripts

* **ls directory:** With npm, `npm run-script ls / -l` or with node, `node scripts/ls.js /remote-dir`.
* **upload file:** `npm run-script upload photo.jpg /destination`

This will look for a `secrets.js` file that looks like this:

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

