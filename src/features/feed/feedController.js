const FeedPost = require('./feedModel');

// Simple Memory Cache (Works like Redis but inside Node.js)
let feedCache = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minutes

exports.createPost = async (req, res) => {
  try {
    const { content, imageUrl } = req.body;

    const newPost = await FeedPost.create({
      user: req.user.id,
      content,
      imageUrl
    });

    // Clear cache when new post is created
    feedCache = null;

    res.status(201).json({
      success: true,
      data: newPost
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

exports.getFeed = async (req, res) => {
  try {
    // 1. Check if valid cache exists
    if (feedCache && (Date.now() - cacheTime < CACHE_DURATION)) {
      return res.status(200).json({
        success: true,
        results: feedCache.length,
        fromCache: true,
        data: feedCache
      });
    }

    // 2. Otherwise fetch from MongoDB
    const posts = await FeedPost.find().sort('-createdAt').limit(50);

    // 3. Update Cache
    feedCache = posts;
    cacheTime = Date.now();

    res.status(200).json({
      success: true,
      results: posts.length,
      fromCache: false,
      data: posts
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

exports.likePost = async (req, res) => {
    try {
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        const index = post.likes.indexOf(req.user.id);
        if (index === -1) {
            post.likes.push(req.user.id);
        } else {
            post.likes.splice(index, 1);
        }

        await post.save();

        // Invalidate cache on like change
        feedCache = null;

        res.json({ success: true, likes: post.likes.length, isLiked: index === -1 });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        post.comments.push({
            user: req.user.id,
            text,
            createdAt: Date.now()
        });

        await post.save();

        // Invalidate cache on new comment
        feedCache = null;

        res.status(201).json({ success: true, data: post.comments });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
