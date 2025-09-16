const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const svgCaptcha = require('svg-captcha');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// session for captcha
app.use(session({
  secret: 'janhit-secret',
  resave: false,
  saveUninitialized: true,
}));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Captcha route
app.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    noise: 3,
    color: true,
    background: '#000000',
  });
  req.session.captcha = captcha.text;
  res.type('svg');
  res.status(200).send(captcha.data);
});

// Form submission
app.post('/submit', (req, res) => {
  const { complaint, aadmob, email, captchaInput } = req.body;

  // Captcha validation
  if (req.session.captcha !== captchaInput) {
    return res.status(400).json({ success: false, message: 'Invalid captcha!' });
  }

  // Aadhaar/Mobile validation
  if (!(aadmob && (/^\d{12}$/.test(aadmob) || /^\d{10}$/.test(aadmob)))) {
    return res.status(400).json({ success: false, message: 'Enter valid Aadhaar (12 digits) or Mobile (10 digits).' });
  }

  // Passed all checks
  res.json({ success: true, message: 'Form submitted successfully!' });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(Server running at http://localhost:${PORT});
});