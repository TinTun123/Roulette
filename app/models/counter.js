var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('LogCounter', new Schema({ 
	name: {
		type: String,		
	},
	date: {
		type: Date, 
		default: Date.now
	}
}));