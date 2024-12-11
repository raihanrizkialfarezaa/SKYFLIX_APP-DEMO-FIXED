require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cloudinary = require('./config/cloudinary');
const { connectDB } = require('./config/database');

// Import all routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const filmRoutes = require('./routes/filmRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contentAccessRoutes = require('./routes/contentAccessRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const activityRoutes = require('./routes/activityRoutes');
const searchRoutes = require('./routes/searchRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportingRoutes = require('./routes/reportingRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Import all services
const NotificationService = require('./services/notificationService');
const SchedulerService = require('./services/schedulerService');
const ActivityTrackerService = require('./services/activityTrackerService');
const RecommendationService = require('./services/recommendationService');
const ReportingService = require('./services/reportingService');
const SearchService = require('./services/searchService');

const app = express();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Upload-specific rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 uploads per hour
  message: 'Too many uploads from this IP, please try again after an hour',
});
app.use('/api/films/upload', uploadLimiter);

// Security middlewares
const helmet = require('helmet');
app.use(helmet());

// Routes with base path '/api'
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/films', filmRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content-access', contentAccessRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve uploads directory in development
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Skyflix API' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle specific types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      errors: err.errors,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      message: 'Unauthorized Access',
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      message: 'File Upload Error',
      error: err.message,
    });
  }

  if (err.name === 'CloudinaryError') {
    return res.status(500).json({
      message: 'Video Upload Error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Error uploading video',
    });
  }

  // Default error response
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 5000;

// Cleanup service for temporary files
function cleanupTempFiles() {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading uploads directory:', err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error getting stats for file ${filePath}:`, err);
          return;
        }

        const now = new Date().getTime();
        const endTime = new Date(stats.mtime).getTime() + 24 * 60 * 60 * 1000;

        if (now > endTime) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Error deleting file ${filePath}:`, err);
            else console.log(`Deleted old file ${filePath}`);
          });
        }
      });
    });
  });
}

// Function to initialize scheduled tasks
async function initializeScheduledTasks() {
  try {
    // Verify Cloudinary connection
    await cloudinary.api
      .ping()
      .then(() => console.log('Cloudinary connection verified'))
      .catch((error) => {
        console.error('Cloudinary connection error:', error);
        throw error;
      });

    // Initialize cleanup service
    setInterval(cleanupTempFiles, 12 * 60 * 60 * 1000); // Run every 12 hours

    // Initialize notification checks
    setInterval(async () => {
      try {
        await NotificationService.checkAndSendRenewalReminders();
      } catch (error) {
        console.error('Error in notification check:', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Initialize core services with proper error handling
    try {
      await SchedulerService.initializeJobs();
      console.log('Scheduler service initialized successfully');
    } catch (error) {
      console.error('Error initializing scheduler service:', error);
    }

    try {
      await RecommendationService.initializeRecommendations();
      console.log('Recommendation service initialized successfully');
    } catch (error) {
      console.error('Error initializing recommendation service:', error);
    }

    // Optional services initialization with existence check
    if (SearchService && typeof SearchService.initializeIndexes === 'function') {
      try {
        await SearchService.initializeIndexes();
        console.log('Search service initialized successfully');
      } catch (error) {
        console.error('Error initializing search service:', error);
      }
    }

    // Schedule daily reports generation
    setInterval(async () => {
      try {
        const date = new Date();
        const yesterday = new Date(date.setDate(date.getDate() - 1));

        // Generate daily reports
        if (ReportingService) {
          await ReportingService.generateUserEngagementReport(yesterday, date);
          await ReportingService.generateContentPerformanceReport('daily');
          await ReportingService.generateSystemHealthReport();
        }

        // Generate Cloudinary usage report
        const cloudinaryUsage = await cloudinary.api.usage();
        console.log('Cloudinary usage report:', cloudinaryUsage);

        console.log('Daily reports generated successfully');
      } catch (error) {
        console.error('Error generating daily reports:', error);
      }
    }, 24 * 60 * 60 * 1000);

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error in service initialization:', error);
    // Don't throw error here to prevent server from crashing
    // Instead, log error and continue with available services
  }
}

// Server startup function
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB successfully');

    // Initialize scheduled tasks and services
    await initializeScheduledTasks();

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(async () => {
        // Cleanup all temporary files
        if (fs.existsSync(uploadDir)) {
          const files = fs.readdirSync(uploadDir);
          for (const file of files) {
            fs.unlinkSync(path.join(uploadDir, file));
          }
          console.log('All temporary files cleaned up');
        }
        console.log('Process terminated');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
