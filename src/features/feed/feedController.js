const FeedPost = require('./feedModel');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'jobo:feed:all';

const invalidateAndBroadcast = async (req, payload) => {
  const redis = getRedis();
  try {
    if (redis) {
      await redis.del(CACHE_KEY);
      await redis.publish('feed_updates', JSON.stringify(payload));
      return;
    }
  } catch (err) {
    console.warn('Feed cache/broadcast failed:', err.message);
  }

  const io = req.app.get('io');
  if (io) io.emit('post_update', payload);
};

const getFeed = async (req, res) => {
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json({ success: true, from: 'redis', data: JSON.parse(cached) });
    }
    const posts = await FeedPost.find()
      .populate('comments.user', 'name education')
      .sort('-createdAt')
      .limit(50);
    if (redis) await redis.set(CACHE_KEY, JSON.stringify(posts), { EX: 300 });
    res.json({ success: true, data: posts });
  } catch (err) { res.status(400).json({ success: false }); }
};

const createPost = async (req, res) => {
  try {
    const content = String(req.body.content || '').trim();
    const imageUrl = req.body.imageUrl || '';

    if (!content && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Post content or image is required' });
    }

    const newPost = await FeedPost.create({ user: req.user.id, content, imageUrl });
    await invalidateAndBroadcast(req, { type: 'new_post', postId: newPost._id });

    res.status(201).json({ success: true, data: newPost });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const likePost = async (req, res) => {
    try {
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        const userId = req.user.id.toString();
        const isLiking = !post.likes.some((id) => id.toString() === userId);
        const update = isLiking ? { $addToSet: { likes: req.user.id } } : { $pull: { likes: req.user.id } };

        const updatedPost = await FeedPost.findByIdAndUpdate(req.params.id, update, { new: true });

        await invalidateAndBroadcast(req, {
            postId: updatedPost._id,
            likes: updatedPost.likes.length,
            likedBy: updatedPost.likes,
            type: 'like'
        });

        res.json({ success: true, data: updatedPost });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

const addComment = async (req, res) => {
    try {
        const text = String(req.body.text || '').trim();
        if (!text) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        const updatedPost = await FeedPost.findByIdAndUpdate(
            req.params.id,
            { $push: { comments: { user: req.user.id, text } } },
            { new: true }
        ).populate('comments.user', 'name education');

        if (!updatedPost) throw new Error('Post not found');

        const newComment = updatedPost.comments[updatedPost.comments.length - 1];
        await invalidateAndBroadcast(req, {
            postId: updatedPost._id,
            commentsCount: updatedPost.comments.length,
            newComment: newComment,
            type: 'comment'
        });

        res.status(201).json({ success: true, data: newComment });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

module.exports = {
  getFeed,
  createPost,
  likePost,
  addComment
};
