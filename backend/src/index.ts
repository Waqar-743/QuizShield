import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import quizRoutes from './routes/quizzes';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import questionRoutes from './routes/questions';
import notificationRoutes from './routes/notifications';

// Initialize app
const app = express();

// Connect to database
connectDatabase();

// Middleware
// Allow strictly defined origins
const allowedOrigins = [
  config.frontendUrl,
  'https://waqar-743.github.io',
  'https://quiz-shield.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

console.log('CORS Configured for origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check against allowed origins (case-insensitive)
    const isAllowed = allowedOrigins.some(o => {
      // Handle potential undefined/null in allowedOrigins
      if (!o) return false;
      return origin.toLowerCase() === o.toLowerCase() ||
        origin.toLowerCase().startsWith(o.toLowerCase());
    });

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`Blocked CORS request from: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Root route for basic verification
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Adaptive Learning API is running',
    environment: config.nodeEnv,
    version: '1.0.0'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

console.log('--- SERVER INITIALIZATION ---');
console.log('Process CWD:', process.cwd());
console.log('Attempting to bind port:', PORT);
try {
  // Debug check to verify dist structure
  const fs = require('fs');
  console.log('Dist contents:', fs.readdirSync('./dist'));
} catch (err) {
  console.log('Directory check failed:', err);
}


if (require.main === module) {
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
    console.log(`Health check available at http://0.0.0.0:${PORT}/health`);
  });

  server.on('error', (error) => {
    console.error('FATAL: Server failed to start:', error);
  });
}


// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  // process.exit(1); // Don't exit in serverless environment
});

export default app;
