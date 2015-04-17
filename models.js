var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');


var userSchema = mongoose.Schema({
	"username" : { type: String },
	"id" : { type: String },
  "facebook" : {
    "id" : { type: String },
    "access_token" : { type: String }
  },
  "instagram" : {
    "id" : { type: String },
    "username" : { type: String },
    "access_token" : { type: String }
  }
});

userSchema.plugin(findOrCreate);

exports.User = mongoose.model('User', userSchema);

