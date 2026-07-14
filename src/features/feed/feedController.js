const FeedPost = require('./feedModel');

exports.createPost = async (req, res) => {
  try {
    const { content, imageUrl } = req.body;

    const newPost = await FeedPost.create({
      user: req.user.id,
      content,
      imageUrl
    });

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
    // Fetch all posts, sorted by newest first
    const posts = await FeedPost.find().sort('-createdAt');

    res.status(200).json({
      success: true,
      results: posts.length,
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
        res.status(201).json({ success: true, data: post.comments });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
