// get the packages we need ========================================
var express 	= require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
mongoose.Promise = require('bluebird');
var fs          = require('fs');

var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User   = require('./app/models/user'); // get our mongoose model
var WonStore = require('./app/models/won_number'); // get our mongoose model
var Message = require('./app/models/Message');
var Counter = require('./app/models/counter'); // get our mongoose model
var path = require('path');
var cookieParser = require('cookie-parser')
var db_utils = require('./app/utils/db.js')
var csvFilePath = './static/csv/file.csv';
var xlsFilePath = './static/csv/wins.xlsx';
var winning_num_constants = require('./app/constants/constants.json')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
var Excel = require('exceljs');
require('dotenv').config();


// configuration ===================================================
var port = process.env.PORT || 8080; 
mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); // secret variable

// use body parser so we  get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));
app.use(express.static('public'))
app.use(cookieParser());

// let remainingTime = 0;



// routes ==========================================================
app.get('/setup', function(req, res) {

	// create a sample user
	var mohan = new User({ 
		name: 'mohan', 
		password: 'password',
		admin: true 
	});

	mohan.save()
	.then(() => {
		console.log('User saved successfully');
		res.json({ success: true });
	})
	.catch((err) => {
		throw err;
	});

});

// basic route (http://localhost:8080)
app.get('/', function(req, res) {
	res.send('Hello! The API is at http://localhost:' + port + '/api');
});

app.get('/login', function(req, res) {
	fs.readFile('public/login.html',function (err, data){
		console.log(data);
		res.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length});
		res.write(data);
		res.end();
	});
});
app.post('/signup', function(req, res) {
	var newUser = new User({ 
		name: req.body.username,
		email: req.body.email,
		password: req.body.password,
		credit : 1000
	});

	console.log('newUser: ', newUser);
	
	newUser.save()
	.then(() => {
		console.log('User saved successfully');
		res.json({ success: true });
	})
	.catch((err) => {
		throw err;
	});


})
// get an instance of the router for api routes
var apiRoutes = express.Router(); 

// ---------------------------------------------------------
// authentication (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------
// http://localhost:8080/api/authenticate

apiRoutes.post('/game', function(req, res) {

	User.findOne({ name: req.body.name }).exec()
	.then((user) => {
		if (!user) {
		res.json({ success: false, message: 'Authentication failed. User not found.' });
		
		} else {
		// check if password matches
		if (user.password !== req.body.password) {
			res.json({ success: false, message: 'Authentication failed. Wrong password.' });
		} else {

			// create a token
			console.log('user: ', user);
			var payload = {
			admin: user.admin,
			id: user.id
			};
			var token = jwt.sign(payload, app.get('superSecret'), {
			expiresIn: 86400 // expires in 24 hours
			});
			
			filepath = 'public/game/index.html';

			if (user.admin) {
				filepath = 'public/adminPanel.html';
			} else {

				const newMessage = new Message({
					sender : '65360b47873890cc0e53f811',
					receiver : user.id,
					text : `Welcome ${user.name} ${user.email}. \nPlease let us know any inconvinent. \n Enjoy playing.`,
			
				});
			
				newMessage.save()
				.then(() => {
					// res.status(201).json({ message: 'Message saved successfully' });
				})
				.catch((err) => {
					console.error('Error saving message:', err);
					// res.status(500).json({ error: 'An error occurred while saving the message' });
				});

				filepath = 'public/game/index.html';
			}
			fs.readFile(filepath, function (err, data) {
			if (err) {
				throw err;
			}
			res.cookie('token', token, { maxAge: 900000 });
			res.writeHead(200, {
				'Content-Type': 'text/html',
				'Content-Length': data.length,
				'x-access-token': token
			});
			res.write(data);
			res.end();
			});
		}
		}
	})
	.catch((err) => {
		throw err;
	});

});

var checkAuth = function(req, res, next) {

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.param('token') || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {			
			if (err) {
				return res.json({ success: false, message: 'Failed to authenticate token.' });		
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;	
				next();
			}
		});

	} else {

		// if there is no token
		// return an error
		return res.status(403).send({ 
			success: false, 
			message: 'No token provided.'
		});
		
	}
	
}

// route middleware to authenticate and check token
apiRoutes.use(function(req, res, next) {
	console.log(req.user);
	console.log('api middle: request token: ', req.body.token);
	// check header or url parameters or post parameters for token
	var token = req.body.token || req.param('token') || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {			
			if (err) {
				return res.json({ success: false, message: 'Failed to authenticate token.' });		
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;	
				next();
			}
		});

	} else {

		// if there is no token
		// return an error
		return res.status(403).send({ 
			success: false, 
			message: 'No token provided.'
		});
		
	}
	
});

// apiRoutes.use('/admin', express.static(path.join(__dirname, 'public')));

// authenticated routes
apiRoutes.get('/', function(req, res) {
	res.json({ message: 'Welcome to the coolest API on earth!' });
});

app.get('/users', function(req, res) {
	User.find({admin : false}).sort({ credit: -1 }).exec().then((users) => {
			
			res.json({success : true, users : users});		
	}).catch((err) => {
		console.log(err);
		res.status(500).json({ success: false, error: err.message });
	});
});

apiRoutes.get('/check', function(req, res) {
	res.json(req.decoded);
});

apiRoutes.post(`/message`, function(req, res) {
	const {senderId, receiverId, text, time} = req.body;

	const newMessage = new Message({
		sender : senderId,
		receiver : receiverId,
		text : text,

	});

	newMessage.save()
	.then(() => {
		res.status(201).json({ message: 'Message saved successfully' });
	})
	.catch((err) => {
		console.error('Error saving message:', err);
		res.status(500).json({ error: 'An error occurred while saving the message' });
	});
})


// app.use('/game', [checkAuth(), express.static('public')]);

apiRoutes.get('/game', function(req, res) {
	var token = req.body.token || req.param('token') || req.headers['x-access-token'];
	// res.redirect('/game/?token=' + token);
	fs.readFile('public/game/index.html',function (err, data){
		res.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length, 'x-access-token': token});
		res.write(data);
		res.end();
	});
});


app.use('/api', apiRoutes);

app.listen(port);

var Pusher = require('pusher');

apiRoutes.post('/pusher/auth', function(req, res) {
	var socketId = req.body.socket_id;
	var channel = req.body.channel_name;
	var auth = pusher.authenticate(socketId, channel);

	res.send(auth);

});

apiRoutes.get('/chatHistory', function (req, res) {
	const payload = req.query.payload;

	// Now you can use the 'payload' data in your server logic
	// For example, you can parse it as JSON
	const payloadData = JSON.parse(payload);
	
	const { senderId, receiverId } = payloadData;

	console.log('senderId: ', senderId);
	console.log('receiverId: ', receiverId);

	Message.find({
		$or: [
		  {
			sender: senderId,
			receiver: receiverId
		  },
		  {
			sender: receiverId,
			receiver: senderId
		  }
		]
	  })
		.sort({ timestamp: 1 })
		.then((messages) => {
		  // Handle the retrieved chat history (messages)
		//   console.log('message fetch: ', messages);
		  res.json({ success : true, message : messages});
		})
		.catch((err) => {
		  // Handle the error
		});


})

apiRoutes.post('/game/user', function(req, res) {

	db_utils.findUserByID(req.decoded.id, function(user){
		if(!user) console.log('No user found');
		else{
			user.credit = req.body.credit;
			// user.save(function(err) {
			// 	if (err) throw err;
				
			// 	console.log('User updated successfully');
			// 	res.json({ success: true });
			// })
			user.save()
			.then(() => {
				console.log('User updated successfully');
				res.json({ success: true });
			})
			.catch((err) => {
				throw err;
			});
		}
	});
});

apiRoutes.get('/game/user', function(req, res) {

	let userId = req.decoded ? req.decoded.id : null;
	db_utils.findUserByID(userId, function(user){
		if(!user) {
			console.log('No user found');
			return res.status(404).json({ success: false, message: 'User not found' });
		} 
		else {

			WonStore.find({}).sort({date: -1}).limit(19).exec().then((nums) => {
				let res_nums = nums.map((num) => {
					return num['won'];
				});
				// res_nums.reverse();
				res.json({ success: true, credit: user.credit, history: res_nums, userName : user.name, userId : user.id});
			}).catch((error) => {
				throw error;
			});

		}
	});

});


var pusher = new Pusher({
  appId: process.env.app_id,
  key: process.env.key,
  secret: process.env.secret,
  cluster: 'ap1',
  useTLS: true,
});


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function updateAndSendRemainingTime() {
	const now = new Date();

	let remainingTime = Math.floor((nextRun - now) / 1000);

	if (remainingTime > 60) {
		remainingTime = Math.floor(remainingTime / 60) + " mins";
		setTimeout(updateAndSendRemainingTime, 40000);
	} else {
		// remainingTime = remainingTime + ' secs';
		// setTimeout(updateAndSendRemainingTime, 1500);
		pusher.trigger('my-channel', 'trigger-timmer', {
			remainingTime: remainingTime,
		});

		// remainingTime = Math.floor((nextRun - now) / 1000);
	}

    pusher.trigger('my-channel', 'remaining-time-event', {
      remainingTime: remainingTime,
    });
}

app.get('/game/getRemainTime', (req, res) => {
	// Assuming you have the remainingTime value available
	/* Get the remaining time value from wherever you store it */;
	let resTime = 0;
	console.log('remainingTime: ', remainingTime);
	if (remainingTime > 60) {
		resTime = `${remainingTime/60} mins`;
		console.log('remainTime abo 60: ', resTime);
	} else {
		console.log('remainTime belo 60: ', resTime);
		resTime = `${remainingTime} secs`;
	}
	// Send the remainingTime as a JSON response
	res.json({ success: true, remainingTime: resTime });

  });

function generateRandNum() {

	var random_nums = [];
	for(var i=0;i<3;i++){
		random_nums.push(getRandomInt(0, 37));
	}
	var final_num = random_nums[getRandomInt(0,2)];

	var won_num = new WonStore({ 
		won: 36 
	});

	// won_num.save(function(err) {
	// 	if (err) throw err;
	// 	console.log('Winning number stored successfully');
	// });

	won_num
    .save()
    .then(() => {
      console.log('Winning number stored successfully');
    })
    .catch((err) => {
      console.error(err);
    });

	console.log({
	  "message": "SPIN",
	  "numbers": random_nums,
	  "number": final_num,
	});

	// console.log('winning constant: ', winning_num_constants);

	pusher.trigger('my-channel', 'my-event', {
	  "message": "SPIN",
	  "numbers": random_nums,
	  "number": final_num,
	});
}
// generateRandNum();

var cron = require('node-cron');
const { log } = require('console');
cron.schedule('*/5 * * * *', () => {
	const now = new Date();
	nextRun = new Date(now.getTime() + 5 * 60 * 1000);
	updateAndSendRemainingTime();
	generateRandNum();
});



var csvDump = async function(res = false){

	const currentDate = new Date();

	const year = currentDate.getFullYear();
	const month = currentDate.toLocaleString('default', {month : 'short'});

	csvFilePath = `./static/csv/${year}_${month}.csv`;
	xlsFilePath = `./static/csv/${year}_${month}.xlsx`;

	const csvWriter = createCsvWriter({
	    path: csvFilePath,
	    // append: true,
	    header: [
	    	{id: "date", title: "date"},
	    	{id: "time", title: "time"},
	        {id: "number", title: "number"},
			{id: "colour", title: "colour"},
			{id: "1-18 / 19-36", title: "1-18 / 19-36"},
			{id: "odd / even", title: "odd / even"},
			{id: "dozen", title: "dozen"},
			{id: "column", title: "column"},
			{id: "three", title: "three"},
			{id: "six", title: "six"},
			{id: "corners", title: "corners"},
			{id: "call", title: "call"},
			{id: "neighbours", title: "neighbours"},
	    ]
	});

	try {

		const currentDate = new Date();
		const currentMonth = currentDate.getMonth();
		const currentYear = currentDate.getFullYear();

		// Calculate the start and end of the current month
		const startOfMonth = new Date(currentYear, currentMonth, 1);
		const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);


		const nums = await WonStore.find(
			{
				date : {
					$gte: startOfMonth,
					$lte: endOfMonth,
				}
			}).sort({ date: -1 }).exec();
	  
		const orderedNums = nums.sort((a, b) => {
		  return b['date'].getTime() - a['date'].getTime();
		});
	  
		const wons = orderedNums.map((num) => {

		  const won = JSON.parse(JSON.stringify(winning_num_constants[num['won']])),
			date = num['date'];
		  won['date'] = date.getUTCDate() + '-' + (date.getUTCMonth() + 1) + '-' + date.getUTCFullYear();
		  won['time'] = date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds();
		  return won;

		});
	  
		await csvWriter.writeRecords(wons); // returns a promise
		console.log('write csv file', csvFilePath);
		if (res) {
		  res.sendFile(path.join(__dirname, csvFilePath));
		}
	  } catch (err) {
		console.error(err);
	  }

}

csvDump();


app.get('/totalSpin', async (req, res) => {
	try {
		const total_spin = await WonStore.countDocuments({});

		res.json({success : true, totalSpin : total_spin});
	} catch (error) {
		console.error(err);
		res.status(500).json({ error: 'An error occurred while fetching the total count' }); 
	}
})

app.get('/getStatistic', (req, res) => {
	try {
		WonStore.aggregate([
			{
			  $group: {
				_id: "$won",
				count: { $sum: 1 },
			  },
			},
			{
			  $sort: { _id: 1 },
			},
			{
			  $addFields: {
				color: {
				  $cond: {
					if: { $eq: ["$_id", 0] },
					then: "neither",
					else: {
					  $cond: {
						if: {
						  $in: ["$_id", [1, 3, 5, 7, 9, 12, 14, 16, 18, 23, 25, 27, 30, 32, 34, 36]],
						},
						then: "red",
						else: "black",
					  },
					},
				  },
				},
			  },
			},
			{
			  $facet: {
				total: [
				  {
					$group: {
					  _id: null,
					  total_count: { $sum: "$count" },
					},
				  },
				],
				counts: [
				  { $match: { _id: { $gte: 0, $lte: 36 } } },
				],
			  },
			},
			{
			  $project: {
				_id: 0,
				total_count: { $arrayElemAt: ["$total.total_count", 0] },
				counts: 1,
			  },
			},
			{
			  $project: {
				counts: 1,
				odd_count: {
				  $reduce: {
					input: "$counts",
					initialValue: 0,
					in: {
					  $cond: {
						if: { $eq: [{ $mod: ["$$this._id", 2] }, 1] },
						then: { $add: ["$$value", "$$this.count"] },
						else: "$$value",
					  },
					},
				  },
				},
				even_count: {
				  $reduce: {
					input: "$counts",
					initialValue: 0,
					in: {
					  $cond: {
						if: { $eq: [{ $mod: ["$$this._id", 2] }, 0] },
						then: { $add: ["$$value", "$$this.count"] },
						else: "$$value",
					  },
					},
				  },
				},
				red_count: {
				  $reduce: {
					input: "$counts",
					initialValue: 0,
					in: {
					  $cond: {
						if: { $eq: ["$$this.color", "red"] },
						then: { $add: ["$$value", "$$this.count"] },
						else: "$$value",
					  },
					},
				  },
				},
				black_count: {
				  $reduce: {
					input: "$counts",
					initialValue: 0,
					in: {
					  $cond: {
						if: { $eq: ["$$this.color", "black"] },
						then: { $add: ["$$value", "$$this.count"] },
						else: "$$value",
					  },
					},
				  },
				},
			  },
			},
		  ]).then((results) => {
			// Handle the results, which will include the total count, counts for individual numbers,
			// odd_count, and even_count
			console.log(results);
			res.json({success : true, result : results})
		  })
		  .catch((err) => {
			// Handle the error
		  });
		  
	} catch (err) {
		console.log(err);
	}
})


app.get('/getStatisticSec', (req, res) => {
	try {
		WonStore.aggregate([
			{
			  $group: {
				_id: null,
				count_1_to_18: {
				  $sum: {
					$cond: [
					  { $lte: ["$won", 18] },
					  1,
					  0,
					],
				  },
				},
				count_19_to_36: {
				  $sum: {
					$cond: [
					  { $gte: ["$won", 19] },
					  1,
					  0,
					],
				  },
				},
				count_first_dozen: {
				  $sum: {
					$cond: [
					  {
						$in: [
						  "$won",
						  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
						],
					  },
					  1,
					  0,
					],
				  },
				},
				count_second_dozen: {
				  $sum: {
					$cond: [
					  {
						$in: [
						  "$won",
						  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
						],
					  },
					  1,
					  0,
					],
				  },
				},
				count_third_dozen: {
				  $sum: {
					$cond: [
					  {
						$in: [
						  "$won",
						  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
						],
					  },
					  1,
					  0,
					],
				  },
				},
				count_first_column: {
				  $sum: {
					$cond: [
					  {
						$in: [
						  "$won",
						  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
						],
					  },
					  1,
					  0,
					],
				  },
				},
				count_second_column: {
				  $sum: {
					$cond: [
					  {
						$in: [
						  "$won",
						  [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
						],
					  },
					  1,
					  0,
					],
				  },
				},
				count_third_column: {
				  $sum: {
					$cond: [
					  {
						$in: [
						  "$won",
						  [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
						],
					  },
					  1,
					  0,
					],
				  },
				},
				count_six_group1: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [1, 2, 3, 4, 5, 6]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_six_group2: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [7, 8, 9, 10, 11, 12]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_six_group3: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [13, 14, 15, 16, 17, 18]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_six_group4: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [19, 20, 21, 22, 23, 24]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_six_group5: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [25, 26, 27, 28, 29, 30]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_six_group6: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [31, 32, 33, 34, 35, 36]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group1: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [1, 2, 3]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group2: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [4, 5, 6]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group3: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [7, 8, 9]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group4: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [10, 11, 12]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group5: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [13, 14, 15]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group6: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [16, 17, 18]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group7: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [19, 20, 21]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group8: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [22, 23, 24]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group9: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [25, 26, 27]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group10: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [28, 29, 30]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group11: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [31, 32, 33]],
						},
						1,
						0,
					  ],
					},
				  },
				  count_three_group12: {
					$sum: {
					  $cond: [
						{
						  $in: ["$won", [34, 35, 36]],
						},
						1,
						0,
					  ],
					},
				  },
			  },
			},
			{
			  $project: {
				_id: 0,
				count_1_to_18: 1,
				count_19_to_36: 1,
				count_first_dozen: 1,
				count_second_dozen: 1,
				count_third_dozen: 1,
				count_first_column: 1,
				count_second_column: 1,
				count_third_column: 1,
				count_six_group1: 1,
				count_six_group2: 1,
				count_six_group3: 1,
				count_six_group4: 1,
				count_six_group5: 1,
				count_six_group6: 1,
				count_three_group1: 1,
				count_three_group2: 1,
				count_three_group3: 1,
				count_three_group4: 1,
				count_three_group5: 1,
				count_three_group6: 1,
				count_three_group7: 1,
				count_three_group8: 1,
				count_three_group9: 1,
				count_three_group10: 1,
				count_three_group11: 1,
				count_three_group12: 1,
			  },
			},
		  ])
		  .then((results) => {
			// Handle the results, which will include the counts for "1 to 18" and "19 to 36"
			console.log(results);
			res.json({success : true, result : results})
		  })
		  .catch((err) => {
			// Handle the error
		  });
		  
	} catch (error) {
		console.log(error);
	}
})


app.get('/uniqueYearMonth', async (req, res) => {
	try {
	  const uniqueYearMonths = await WonStore.aggregate([
		{
		  $project: {
			yearMonth: {
			  $dateToString: { format: '%Y-%m', date: '$date' }
			}
		  }
		},
		{
		  $group: {
			_id: '$yearMonth'
		  }
		},
		{
		  $sort: {
			_id: 1
		  }
		}
	  ]);
  
	  const result = uniqueYearMonths.map((item) => item._id);
  
	  res.json(result);
	} catch (error) {
	  console.error('Error getting unique year and month combinations:', error);
	  res.status(500).json({ error: 'An error occurred while fetching data' });
	}
  });



apiRoutes.get('/csv', function(req, res) {
	csvDump();
	console.log('open csvfile', csvFilePath);
	var workbook = new Excel.Workbook();
	workbook.csv.readFile(csvFilePath)
	.then(function(worksheet) {
	    // use workbook or worksheet
	    workbook.xlsx.writeFile(xlsFilePath)
	    .then(function() {

	        console.log('DONE');
			const filename = xlsFilePath.split('/').pop();

			res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
	        res.sendFile(path.join(__dirname, xlsFilePath));

	    });
	});

})



app.get('/csv', async function(req, res) {
	await csvDump();
	let filePath = csvFilePath;
	let xlsPath = xlsFilePath;
	if (req.query && req.query.fileName) {
		let queryDate = req.query.fileName;
	
		const [year, month] = queryDate.split('-');
		const monthNames = [

			'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June',
			'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'

		  ];

		const monthName = monthNames[parseInt(month) - 1];
		const outputFileName = `${year}_${monthName}.csv`;

		filePath = `./static/csv/${outputFileName}`;
		xlsPath = `./static/csv/${year}_${monthName}.xlsx`;
	}

	console.log('open csvfile', filePath);
	var workbook = new Excel.Workbook();
	workbook.csv.readFile(filePath)

	.then(function(worksheet) {
	    // use workbook or worksheet
	    workbook.xlsx.writeFile(xlsPath)
	    .then(function() {
	        console.log('DONE');
			
			const filename = xlsPath.split('/').pop();

			res.setHeader('Content-Disposition', 'attachment; filename=' + filename);

	        saveLog('download')
	        res.sendFile(path.join(__dirname, xlsPath));
	    });

	});

});

app.get('/game/history', function(req, res) {
	console.log('fetch history');
	// WonStore.find({}).sort({date: -1}).limit(19).exec(function(err, nums) {
	// 	if(err) throw err;
	// 	let res_nums = nums.map((num) => {
	// 		return num['won'];
	// 	});
	// 	console.log(res_nums);
	// 	// res_nums.reverse();
	// 	res.json({success: true, history: res_nums});
	// });
	WonStore.find({}).sort({date: -1}).limit(19).exec()
	.then((nums) => {

		let res_nums = nums.map((num) => {
		return num['won'];

		});

		console.log(res_nums);
		// res_nums.reverse();
		res.json({success: true, history: res_nums});
	})
	.catch((err) => {
		throw err;
	});
	console.log(req.body);
});

function saveLog(name, cb){
	console.log(name);
	var count = new Counter({ 
		name: name
	});

	console.log('count from saveLog: ', count);

	count
    .save()
    .then(() => {
      console.log('Count entry added');
	  if(cb) cb(true);
      return true;
    })
    .catch((err) => {
      throw err;
    });
}

function getLog(name, cb){
	console.log(name);
	console.log(typeof(name));
	try{
		console.log(JSON.parse(name));
		(Array.isArray(JSON.parse(name))) ? console.log('ARRAY') : console.log('NOT ARRAY')
		name = JSON.parse(name);
	}
	catch(e){
		console.log('Not able to parse');
	}

	console.log(name);
	// Counter.find({name: name}, function(err, logs) {
	// 	if (err) throw err;
	// 	let res = {};
	// 	logs.forEach((log) => {
	// 		if(res[log.name]) res[log.name] += 1;
	// 		else res[log.name] = 1;
	// 	});
	// 	console.log(res);


	// 	if(cb) cb(res);

	// });

	Counter.find({ name: name })
    .exec()
    .then((logs) => {
      let res = {};
      logs.forEach((log) => {
        if (res[log.name]) res[log.name] += 1;
        else res[log.name] = 1;
      });
      console.log(res);
	  if(cb) cb(res);
      return res;
    })
    .catch((err) => {
      throw err;
    });
	
}


app.post('/game/count', function(req, res) {
	saveLog(req.body.name, function(){
		res.json({ success: true });
	});
});

app.get('/game/count', function(req, res) {
	var name = req.param('name');
	console.log(req.params);
	console.log(name);
	
	getLog(name, function(count){
		res.json({ success: true, data: count});
	});
});




