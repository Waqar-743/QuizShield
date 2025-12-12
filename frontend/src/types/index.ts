export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  avatar?: string;
  bio?: string;
  interests?: string[];
  preferences?: {
    defaultDifficulty: 'Easy' | 'Medium' | 'Hard';
    preferredQuizLength: number;
    notificationEnabled: boolean;
  };
}

export interface Course {
  _id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'; // Changed from difficultyLevel to match usage
  difficultyLevel?: 'Beginner' | 'Intermediate' | 'Advanced'; // Keep for backward compatibility if needed
  createdBy: User | string;
  isPublic: boolean;
  enrolledStudents: string[];
  topics: string[];
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  _id: string;
  courseId: string;
  title: string;
  description: string;
  content: string;
  order: number;
  difficulty?: string; // Added to match usage
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  _id: string;
  topicId: string;
  content: string; // Changed from questionText to match usage
  questionText?: string; // Keep for backward compatibility
  questionType: 'multipleChoice' | 'trueOrFalse' | 'shortAnswer' | 'fillInBlanks';
  options: string[];
  correctAnswer?: string; // Hidden from student during quiz
  explanation?: string; // Hidden from student during quiz
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface Quiz {
  _id: string;
  topicId: string;
  title: string;
  questions: Question[];
  createdAt: string;
}

export interface QuizAttempt {
  _id: string;
  studentId: string;
  quizId: string;
  topicId: string | Topic;
  courseId: string | Course;
  answers: {
    questionId: string | Question;
    studentAnswer: string;
    isCorrect: boolean;
    selectedAnswer?: string; // Added to match usage
  }[];
  score: number;
  maxScore: number; // Added to match usage
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  timeTaken: number;
  isCompleted: boolean; // Added to match usage
  attemptedAt: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  nextDifficultyRecommendation: 'Easy' | 'Medium' | 'Hard';
}

export interface Analytics {
  coursesEnrolled: number; // Changed from enrolledCoursesCount
  quizzesCompleted: number; // Added
  averageScore: number;
  streakDays: number; // Changed from streak
  
  // Keep old ones optional if needed
  enrolledCoursesCount?: number;
  totalQuestionsAnswered?: number;
  streak?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    errors?: { field: string; message: string }[];
  };
}
