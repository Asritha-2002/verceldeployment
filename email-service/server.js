// // const express = require('express');
// // require('dotenv').config();
// // const { sendVerificationEmail } = require('./emails'); // your updated file

// // const app = express();
// // app.use(express.json());

// // console.log("SendGrid key starts with:", process.env.SENDGRID_API_KEY?.slice(0, 6));
// // app.post('/send-email', async (req, res) => {
// //   try {
// //     const { email, token } = req.body;
// //     if (!email || !token) return res.status(400).json({ error: 'Missing email or token' });

// //     await sendVerificationEmail(email, token);

// //     res.status(200).json({ message: 'Email sent successfully' });
// //   } catch (error) {
// //     console.error(error);
// //     if (error.response && error.response.body && error.response.body.errors) {
// //   console.error("SendGrid detailed errors:", JSON.stringify(error.response.body.errors, null, 2));
// // }
// //     res.status(500).json({ error: error.message });
// //   }
// // });

// // const PORT = process.env.PORT;
// // if (!PORT) {
// //   console.error("Error: PORT environment variable not set. Exiting...");
// //   process.exit(1);
// // }
// // app.listen(PORT, () => console.log(`Email service running on port ${PORT}`));













// const express = require('express');
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// const app = express();
// app.use(express.json());

// // EMAIL API ROUTE
// app.post('/send-email', async (req, res) => {
//   //  console.log('Received /send-email request', req.body);
//   try {
//     const { mailOptions } = req.body; // ✅ FIX

//     if (!mailOptions) {
//       return res.status(400).json({ error: 'Missing mailOptions' });
//     }

//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASSWORD
//       }
//     });

//     const info = await transporter.sendMail(mailOptions);

//     res.status(200).json({
//       message: 'Email sent successfully',
//       info
//     });

//   } catch (error) {
//     console.error('Email error:', error);
//     res.status(500).json({
//       error: error.message
//     });
//   }
// });
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Email service running on port ${PORT}`);
// });