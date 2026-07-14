const FeedPost = require('./feedModel');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'jobo:feed:all';

exports.createPost = async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    const newPost = await FeedPost.create({ user: req.user.id, content, imageUrl });

    // Force refresh cache for everyone when NEW content is added
    const redis = getRedis();
    if (redis) {
        await redis.del(CACHE_KEY);
        // Optionally broadcast new post event
        await redis.publish('feed_updates', JSON.stringify({
            type: 'new_post'
        }));
    }

    res.status(201).json({ success: true, data: newPost });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json({ success: true, from: 'redis', data: JSON.parse(cached) });
    }
    const posts = await FeedPost.find().sort('-createdAt').limit(50);
    if (redis) await redis.set(CACHE_KEY, JSON.stringify(posts), { EX: 300 });
    res.json({ success: true, data: posts });
  } catch (err) { res.status(400).json({ success: false }); }
};

exports.likePost = async (req, res) => {
    try {
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        const isLiking = !post.likes.includes(req.user.id);
        const update = isLiking ? { $addToSet: { likes: req.user.id } } : { $pull: { likes: req.user.id } };

        const updatedPost = await FeedPost.findByIdAndUpdate(req.params.id, update, { new: true });

        // PUBLISH TO REDIS: All other users will see this instantly
        const redis = getRedis();
        if (redis) {
            await redis.publish('feed_updates', JSON.stringify({
                postId: updatedPost._id,
                likes: updatedPost.likes.length,
                type: 'like'
            }));
        }

        res.json({ success: true });
    } catch (err) { res.status(400).json({ success: false }); }
};

exports.addComment = async (req, res) => {
    try {
        const updatedPost = await FeedPost.findByIdAndUpdate(
            req.params.id,
            { $push: { comments: { user: req.user.id, text: req.body.text } } },
            { new: true }
        );

        // PUBLISH TO REDIS
        const redis = getRedis();
        if (redis) {
            await redis.publish('feed_updates', JSON.stringify({
                postId: updatedPost._id,
                commentsCount: updatedPost.comments.length,
                type: 'comment'
            }));
        }

        res.status(201).json({ success: true });
    } catch (err) { res.status(400).json({ success: false }); }
};
