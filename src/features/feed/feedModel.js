const mongoose = require('mongoose');

const feedPostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Post must belong to a user']
  },
  content: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String
  },
  likes: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  ],
  comments: [
    {
      user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      text: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Populate user details when fetching posts
feedPostSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'name education domicilState' // adjust based on userModel
  });
  next();
});

module.exports = mongoose.model('FeedPost', feedPostSchema);
