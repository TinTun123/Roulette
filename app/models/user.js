var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('User', new Schema({ 
	name: {
		type: String,
		unique: true
	}, 
	email: {
        type: String,
		required: true,
        unique: true, // Add validation if email is required
    },
	password: String, 
	admin: {
		type: Boolean,
		default: false  // Set the default value for admin to false
	},
	credit: Number
}));