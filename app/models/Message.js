const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a Message schema
const messageSchema = new Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the User who sent the message
    ref: 'User' // This should match the name of your User model
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the User who receives the message
    ref: 'User' // This should match the name of your User model
  },
  text: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Create a Message model
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
