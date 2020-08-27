const express = require('express');
const request = require('request');
const config = require('config');
const router = express.Router();
const auth = require('../../middleware/auth');
const { check, validationResult } = require('express-validator');
// bring in normalize to give us a proper url, regardless of what user entered
const normalize = require('normalize-url');

const Profile = require('../../models/Profile');
const User = require('../../models/User');
const Post = require('../../models/Post');

// @route    GET api/profile/me
// @desc     Get current users profile
// @access   Private
router.get('/me', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.user.id
    }).populate('user', ['name', 'avatar']);

    if (!profile) {
      return res.status(400).json({ msg: 'There is no profile for this user' });
    }

    res.json(profile);
  } catch (err) {
    console.error(err.message);

    res.status(500).send('Server Error');
  }
});

// @route    POST api/profile
// @desc     Create or update user profile
// @access   Private
router.post(
  '/',
  [
    auth,
    [
      check('status', 'Status is required').not().isEmpty(),
      check('skills', 'Skills are required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      company,
      location,
      website,
      bio,
      skills,
      status,
      githubusername,
      youtube,
      twitter,
      instagram,
      linkedin,
      facebook
    } = req.body;

    // Build profile object
    const profileFields = {
      user: req.user.id,
      company,
      location,
      website:
        // if website exists and the URL is not empty
        website && website !== ''
          ? // then normalize the URL
            normalize(website, { forceHttps: true })
          : // otherwise set to ""
            '',
      bio,
      // If skills is an array
      skills: Array.isArray(skills)
        ? // then leave it as it is
          skills
        : // otherwise split it into an array
          skills.split(',').map((skill) => ' ' + skill.trim()),
      status,
      githubusername
    };

    // Build social object and add to profileFields
    const socialfields = { youtube, twitter, instagram, linkedin, facebook };

    for (const [key, value] of Object.entries(socialfields)) {
      // If value is not null and length is greater than 0
      if (value && value.length > 0)
        // Normalize the URL and force HTTPS
        socialfields[key] = normalize(value, { forceHttps: true });
    }
    profileFields.social = socialfields;

    try {
      // Using upsert option (creates new doc if no match is found):
      let profile = await Profile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true, upsert: true }
      );

      res.json(profile);
    } catch (err) {
      console.error(err.message);

      res.status(500).send('Server Error');
    }
  }
);

// @route    GET api/profile
// @desc     Get all profiles
// @access   Public
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find().populate('user', ['name', 'avatar']);
    res.json(profiles);
  } catch (err) {
    console.error(err.message);

    res.status(500).send('Server error');
  }
});

// @route    GET api/profile/user/:user_id
// @desc     Get profile by user ID
// @access   Public
router.get('/user/:user_id', async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.params.user_id
    }).populate('user', ['name', 'avatar']);

    if (!profile) return res.status(400).json({ msg: 'Profile not found' });

    res.json(profile);
  } catch (err) {
    console.error(err.message);

    if (err.kind === 'ObjectId')
      return res.status(400).json({ msg: 'Profile not found' });

    res.status(500).send('Server error');
  }
});

// @route    DELETE api/profile
// @desc     Delete profile, user & posts
// @access   Private
router.delete('/', auth, async (req, res) => {
  try {
    // Remove user posts
    await Post.deleteMany({ user: req.user.id });
    // Remove profile
    await Profile.findOneAndRemove({ user: req.user.id });
    // Remove user
    await User.findOneAndRemove({ _id: req.user.id });
    // Send message to the client
    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error(err.message);

    res.status(500).send('Server error');
  }
});

// @route    PUT api/profile/experience
// @desc     Add profile experience
// @access   Private
router.put(
  '/experience',
  [
    auth,
    [
      // Checking whether user entered the required fields
      check('title', 'Title is required').not().isEmpty(),
      check('company', 'Company is required').not().isEmpty(),
      check('from', 'From date is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    // Variable to store validation error message
    const errors = validationResult(req);

    // If there is a validation error
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array });
    }

    // Destructuring from request body
    const {
      title,
      company,
      location,
      from,
      to,
      current,
      description
    } = req.body;

    // New work experience
    const newExp = { title, company, location, from, to, current, description };

    try {
      // Find the user profile by it's user id, not profile id
      const profile = await Profile.findOne({ user: req.user.id });

      // Adding the new work experience to the experience array of the profile as the first element
      profile.experience.unshift(newExp);

      // Save/persist the updated profile to DB
      await profile.save();

      // Send the data to the client
      res.json(profile);
    } catch (err) {
      console.error(err.message);

      res.status(500).send('Server error');
    }
  }
);

// @route    DELETE api/profile/experience/:exp_id
// @desc     Delete experience from profile
// @access   Private
router.delete('/experience/:exp_id', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    // Get remove index
    const removeIndex = profile.experience
      // For each experience in the work experience array
      .map((item) => item.id)
      // Compare the experience id with the given exp_id
      .indexOf(req.params.exp_id);

    // Removing the matching work experience
    profile.experience.splice(removeIndex, 1);

    // Save/persist the updated profile to DB
    await profile.save();

    // Send the data to the client
    res.json(profile);
  } catch (err) {
    console.error(err.message);

    res.status(500).send('Server error');
  }
});

// @route    PUT api/profile/education
// @desc     Add profile education
// @access   Private
router.put(
  '/education',
  [
    auth,
    [
      // Checking whether user entered the required fields
      check('school', 'School is required').not().isEmpty(),
      check('degree', 'Degree is required').not().isEmpty(),
      check('fieldofstudy', 'Field of study is required').not().isEmpty(),
      check('from', 'from date is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    // Variable to store the validation error
    const errors = validationResult(req);

    // If there is a validation error
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array });
    }

    // Destructuring from the request body
    const {
      school,
      degree,
      fieldofstudy,
      from,
      to,
      current,
      description
    } = req.body;

    // New education object
    const newEdu = {
      school,
      degree,
      fieldofstudy,
      from,
      to,
      current,
      description
    };

    try {
      // Find user profile by it's user id, not profile id
      const profile = await Profile.findOne({ user: req.user.id });

      // Adding the new education to the education array of the profile as the first element
      profile.education.unshift(newEdu);

      // Save/persist the updated profile to the DB
      await profile.save();

      // Send the data to the client
      res.json(profile);
    } catch (err) {
      console.error(err.message);

      res.status(500).send('Server error');
    }
  }
);

// @route    DELETE api/profile/education/:edu_id
// @desc     Delete education from profile
// @access   Private
router.delete('/education/:edu_id', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    // Get remove index
    const removeIndex = profile.education
      //For each education in the education array
      .map((item) => item.id)
      // Compare the education id with the given edu_id
      .indexOf(req.params.edu_id);

    // Removing the matching education
    profile.education.splice(removeIndex, 1);

    // Save/persist the updated profile to the DB
    await profile.save();

    res.json(profile);
  } catch (err) {
    console.error(err.message);

    res.status(500).send('Server error');
  }
});

// @route    GET api/profile/github/:username
// @desc     Get user repositories from Github
// @access   Public
router.get('/github/:username', (req, res) => {
  // Creating options object to use for request
  try {
    const options = {
      uri: `https://api.github.com/users/${
        req.params.username
      }/repos?per_page=5&sort=created:asc&client_id=${config.get(
        'githubClientId'
      )}&client_secret=${config.get('githubSecret')}`,
      method: 'GET',
      headers: { 'user-agent': 'node.js' }
    };

    // Sending request according to the paramters in options object
    request(options, (error, response, body) => {
      if (error) console.error(error);

      // If the response is not "OK", show error message
      if (response.statusCode !== 200) {
        return res.status(404).json({ msg: 'No Github profile found' });
      }

      // If there response is "OK", parse the data in response.
      res.json(JSON.parse(body));
    });
  } catch (err) {
    console.error(err.message);

    res.status(500).send('Server error');
  }
});

module.exports = router;
