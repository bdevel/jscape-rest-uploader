var _base = require('./_base');

// find first arg without hyphen
var path = _base.args.filter(function(i){return i[0] !== '-';})[0] || '/';

function verbose(file) {
  var out = '';
  var date = new Date(file.lastModificationDate);
  
  out += (file.readable ? 'R':'-');
  out += (file.writable ? 'W':'-');
  out += "  "

  out +=  file.type + "\t";
  out +=  file.type == 'DIRECTORY' ? " \t" : Math.round(file.size / 1000) + "KB\t";

  
  out +=  date.toLocaleDateString() + " " + date.toLocaleTimeString() + "\t";  
  out +=  file.name + "\t";
  
  return console.log(out);
}


_base.uploader.listFiles(path).then(function (list) {
  list.forEach(function (file) {
    if (_base.args.indexOf('-l') > -1){
      verbose(file);
    } else{
      console.log(file.path);
    }
  });
  
}, function (error) {
  console.log("Error:", error);
}).catch(function (error) {
  console.log("Exception: ", error);
});

