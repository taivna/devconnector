const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');

const Post = require('../../models/Post');
const Profile = require('../../models/Profile');
const User = require('../../models/User');

// @route POST api/posts
// @desc  Create a post
// @access Private
router.post(
  '/',
  [auth, [check('text', 'Text is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Find user by it's id, and retrieve it, without the password
      const user = await User.findById(req.user.id).select('-password');

      // Creating post object
      const newPost = new Post({
        text: req.body.text,
        name: user.name,
        avatar: user.avatar,
        user: req.user.id
      });

      // Save/persist the post to the database
      const post = await newPost.save();

      // Send the post to the client
      res.json(post);
    } catch (err) {
      console.log(err.message);

      // Sending error message to the client
      res.status(500).send('Server error');
    }
  }
);

// @route GET api/posts
// @desc  Get all posts
// @access Private
router.get('/', auth, async (req, res) => {
  try {
    // Get all posts sorted by date in ascending order
    const posts = await Post.find().sort({ date: -1 });
    res.json(posts);
  } catch (err) {
    console.log(err.message);

    // Sending error message to the client
    res.status(500).send('Server error');
  }
});

// @route GET api/posts/:id
// @desc  Get post by id
// @access Private
router.get('/:id', auth, async (req, res) => {
  try {
    // Get all posts sorted by date in ascending order
    const post = await Post.findById(req.params.id);

    // If no post found with the given id
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    res.json(post);
  } catch (err) {
    console.log(err.message);

    // If err.kind equals 'ObjectId', it means it's not a formatted object id
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Sending error message to the client
    res.status(500).send('Server error');
  }
});

// @route DELETE api/posts/:id
// @desc  Delete a post
// @access Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Get all posts sorted by date in ascending order
    const post = await Post.findById(req.params.id);

    // If err.kind equals 'ObjectId', it means it's not a formatted object id
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Check if the logged in user is the user who created the post
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User is not authorized' });
    }

    // Remove the post
    await post.remove();

    res.json({ msg: 'Post removed' });
  } catch (err) {
    console.log(err.message);

    // If err.kind equals 'ObjectId', it means it's not a formatted object id
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Sending error message to the client
    res.status(500).send('Server error');
  }
});

// @route PUT api/posts/like/:id
// @desc  Like a post
// @access Private
router.put('/like/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    // Check if the post has already been liked by this user
    if (
      post.likes.filter((like) => like.user.toString() === req.user.id).length >
      0
    ) {
      return res.status(400).json({ msg: 'Post already liked' });
    }

    // Add the post to the liked posts array
    post.likes.unshift({ user: req.user.id });

    // Persist the update to DB
    await post.save();

    res.json(post.likes);
  } catch (error) {
    console.log(err.message);

    // If err.kind equals 'ObjectId', it means it's not a formatted object id
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Sending error message to the client
    res.status(500).send('Server error');
  }
});

// @route PUT api/posts/unlike/:id
// @desc  Unlike a post
// @access Private
router.put('/unlike/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    // Check if the post has already been unliked by this user
    if (
      post.likes.filter((like) => like.user.toString() === req.user.id)
        .length === 0
    ) {
      return res.status(400).json({ msg: 'Post has not yet been liked' });
    }

    // Get remove index
    const removeIndex = post.likes
      .map((like) => like.user.toString())
      .indexOf(req.user.id);

    // Remove a "like" from the post
    post.likes.splice(removeIndex, 1);

    // Persist the update to DB
    await post.save();

    res.json(post.likes);
  } catch (error) {
    console.log(err.message);

    // If err.kind equals 'ObjectId', it means it's not a formatted object id
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Sending error message to the client
    res.status(500).send('Server error');
  }
});

// @route POST api/posts/comment/:id
// @desc  Comment on a post
// @access Private
router.post(
  '/comment/:id',
  [auth, [check('text', 'Text is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    // If there are validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Find user by it's id, and retrieve it, without the password
      const user = await User.findById(req.user.id).select('-password');
      const post = await Post.findById(req.params.id);

      // Creating a comment object
      const newComment = {
        text: req.body.text,
        name: user.name,
        avatar: user.avatar,
        user: req.user.id
      };

      // Add the new comment to the comments array
      post.comments.unshift(newComment);

      // Save/persist the post to the database
      await post.save();

      // Send the post to the client
      res.json(post.comments);
    } catch (err) {
      console.error(err.message);

      // Sending error message to the client
      res.status(500).send('Server error');
    }
  }
);

// @route DELETE api/posts/comment/:id/:comment_id
// @desc  Delete a comment
// @access Private
router.delete('/comment/:id/:comment_id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    // Pull out comment
    const comment = post.comments.find(
      (comment) => comment.id === req.params.comment_id
    );

    // Make sure comment exists
    if (!comment) {
      return res.status(404).json({ msg: 'Comment does not exist' });
    }

    // Check if the logged in user is the commenter
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User is not authorized' });
    }

    // Get remove index
    const removeIndex = post.comments
      .map((comment) => comment.user.toString())
      .indexOf(req.user.id);

    // Remove a "like" from the post
    post.comments.splice(removeIndex, 1);

    // Persist the update to DB
    await post.save();

    res.json(post.comments);
  } catch (err) {
    console.error(err.message);

    // Sending error message to the client
    res.status(500).send('Server error');
  }
});

module.exports = router;
