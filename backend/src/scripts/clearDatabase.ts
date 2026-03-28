import { supabase } from '../config/supabase';

async function clearDatabase() {
  console.log('🗑️  Clearing all database data...\n');

  try {
    // Delete in order to respect foreign key constraints
    // Child tables first, then parent tables

    // 1. Quiz answers (if exists)
    console.log('Deleting quiz_answers...');
    await supabase.from('quiz_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Quiz attempts
    console.log('Deleting quiz_attempts...');
    await supabase.from('quiz_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Questions
    console.log('Deleting questions...');
    await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 4. Quizzes
    console.log('Deleting quizzes...');
    await supabase.from('quizzes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 5. Enrollments
    console.log('Deleting enrollments...');
    await supabase.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 6. Topics
    console.log('Deleting topics...');
    await supabase.from('topics').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 7. Courses
    console.log('Deleting courses...');
    await supabase.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 8. Users (last, as other tables reference it)
    console.log('Deleting users...');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('\n✅ All database data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  }

  process.exit(0);
}

clearDatabase();
