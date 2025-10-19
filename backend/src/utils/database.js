import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/kubepulse';
    
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Connection error handler
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
    });

    // Disconnection handler
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    // Reconnection handler
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    console.error('Stack:', error.stack);
    
    // Retry connection after 5 seconds
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

/**
 * Gracefully disconnect from MongoDB
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB disconnected gracefully');
  } catch (error) {
    console.error(`❌ Error disconnecting from MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Check if database is connected
 * @returns {boolean}
 */
export const isConnected = () => {
  return mongoose.connection.readyState === 1;
};
