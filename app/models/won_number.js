var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('WonNumber', new Schema({ 
	won: {
		type: Number,		
	},
	date: { type: Date, default: Date.now }
}));