const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const appointmentRoutes=require('./routes/appointmentRoutes')
const reviewRoute=require('./routes/reviewRoute.js')
const adminRoutes = require('./routes/adminRoutes');
const orderRoutes = require('./routes/orderRoutes.js')
const emailRoutes=require('./routes/emailRoutes.js')

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT;


// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use('/api/email',emailRoutes)
app.use("/invoices", express.static("invoices"));
app.use('/api/users', userRoutes);
app.use('/api/users',appointmentRoutes)
app.use('/api/users',reviewRoute)
app.use('/api/admin',adminRoutes)
app.use('/api/orders', orderRoutes);
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html'));
// });

app.use((err, req, res, next) => {
    // console.error('Error:', {
    //     message: err.message,
    //     stack: err.stack,
    //     timestamp: new Date().toISOString()
    // });
    res.status(500).json({ 
        message: err.message,
        status: 'error'
    });
});
// Database connection with retry logic
const connectDB = async (retries = 3) => {
   //console.log("ENV CHECK:", process.env.MONGODB_URI_PROD);
    const dbURI = process.env.NODE_ENV === 'production' 
        ? process.env.MONGODB_URI_PROD 
        : process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/bookstore';

    try {
        await mongoose.connect(dbURI);
        console.log('MongoDB Connected Successfully');
    } catch (error) {
        if (retries > 0) {
            console.log(`MongoDB connection failed. Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDB(retries - 1);
        }
        console.error('MongoDB connection failed after all retries:', error);
        process.exit(1);
    }
};

// Start server
const startServer = async () => {
    await connectDB();
    
    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        //console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
};

// Start the server
startServer().catch(console.error);
