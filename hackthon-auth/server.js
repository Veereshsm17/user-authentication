const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/authDemo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: String,
  password: String,
  otp: String,
  otpExpiry: Date
});
const User = mongoose.model('User', userSchema);

// Middlewares
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true
}));

// Routes

app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('home', { user: req.session.user });
});

app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  // Email validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.render('signup', { error: 'Please enter a valid email address!' });
  }

  // Password length validation
  if (password.length < 6) {
    return res.render('signup', { error: 'Password must be at least 6 characters long!' });
  }

  try {
    const existingUser = await User.findOne({ $or: [ { username }, { email } ] });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.render('signup', { error: 'Username already exists!' });
      }
      if (existingUser.email === email) {
        return res.render('signup', { error: 'Email already registered!' });
      }
    }

    await User.create({ username, email, password });
    res.redirect('/login');

  } catch (err) {
    console.error(err);
    res.render('signup', { error: 'An error occurred during signup' });
  }
});





app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/login', (req, res) => {
  res.render('login');  // No error initially
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) {
    req.session.user = user;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid username or password' });
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Forgot Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'YOUR_EMAIL',
    pass: 'YOUR_GMAIL_APP_PASSWORD'  // This is your Gmail app password, not your normal password
  }
});

app.get('/forgot', (req, res) => {
  res.render('forgot', { error: null });
});



app.post('/forgot', async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });
  
  if (!user) {
    return res.render('forgot', { error: 'No user found with that username' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 mins

  user.otp = otp;
  user.otpExpiry = expiry;
  await user.save();

  try {
    await transporter.sendMail({
      from: 'YOUR_EMAIL',
      to: user.email,
      subject: 'Your OTP for Password Reset',
      text: `Your OTP is ${otp}. It is valid for 10 minutes.`
    });

    console.log(`✅ OTP email sent to ${user.email}`);
    res.redirect(`/verify-otp?username=${username}`);
  } catch (err) {
    console.error(`❌ Error sending email:`, err);
    res.send('Failed to send OTP email. Please try again.');
  }
});



app.get('/verify-otp', (req, res) => {
  res.render('verify-otp', { username: req.query.username });
});

app.post('/verify-otp', async (req, res) => {
  const { username, otp } = req.body;
  const user = await User.findOne({ username });
  
  if (user && user.otp === otp && user.otpExpiry > Date.now()) {
    res.redirect(`/reset?username=${username}`);
  } else {
    res.render('verify-otp', { username, error: 'Invalid or expired OTP' });
  }
});


app.get('/reset', (req, res) => {
  res.render('reset', { username: req.query.username });
});

app.post('/reset', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user) {
    user.password = password;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
    res.render('reset-success');
  } else {
    res.send('Error resetting password. <a href="/forgot">Try again</a>');
  }
});

// Start server
app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});