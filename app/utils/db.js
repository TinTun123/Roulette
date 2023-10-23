var User   = require('../models/user'); // get our mongoose model
exports.findUserByID =  function(id, cb){
	User.findOne({
		_id: id
	}).then((user) => {
		

		if (!user) {
			// res.json({ success: false, message: 'Authentication failed. User not found.' });
			cb(false);
		} else if (user) {
			cb(user)
		}
	}).catch(error => {
		throw error;
	})
}