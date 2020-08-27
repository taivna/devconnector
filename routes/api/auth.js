const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const { check, validationResult } = require('express-validator');

//const User = require('../../models/User');

// @route GET api/auth
// @desc Test route
// @access Public
router.get('/', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user.id).select('-password');
		res.json(user);
	} catch (error) {
		console.error(error.message);
		res.status(500).send('Server error');
	}
});

// @route POST api/auth
// @desc Authenticate user & get token
// @access Public
router.post(
	'/',
	[ check('email', 'Please include a valid email').isEmail(), check('password', 'Password is required').exists() ],
	async (req, res) => {
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		// Destructuring from req.body
		const { email, password } = req.body;

		try {
			// Check if user exists
			let user = await User.findOne({ email });

			if (!user) {
				return res.status(400).json({ errors: [ { msg: 'Invalid credentials' } ] });
			}

			// Comparing the password sent to the server with the decrypted password returned from the server
			const isMatch = await bcrypt.compare(password, user.password);

			if (!isMatch) {
				return res.status(400).json({ errors: [ { msg: 'Invalid credentials' } ] });
			}

			const payLoad = {
				user: {
					id: user.id
				}
			};

			jwt.sign(payLoad, config.get('jwtSecret'), { expiresIn: 36000 }, (err, token) => {
				if (err) throw err;
				res.json({ token });
			});
		} catch (error) {
			console.error(error.message);
			res.status(500).send('Server error');
		}
	}
);

module.exports = router;
