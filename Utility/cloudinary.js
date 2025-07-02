// cloudinary.js
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: 'daqnei8gj',       // 🔁 Replace with your actual cloud name
  api_key: '552497212889278',
  api_secret: 'lFabWSMlyfB3w2qf4gaNBmI3z4U'
});

module.exports = cloudinary;