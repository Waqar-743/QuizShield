import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

interface ForgotPasswordFormValues {
  email: string;
}

const ForgotPasswordPage = () => {
  const { requestPasswordReset, isLoading } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>();

  const onSubmit = async ({ email }: ForgotPasswordFormValues) => {
    try {
      const message = await requestPasswordReset(email);
      toast.success(message);
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || 'Failed to send reset email';
      toast.error(message);
    }
  };

  return (
    <div>
      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Forgot your password?
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Enter your email address and we&apos;ll send you a password reset link.
      </p>

      <div className="mt-8">
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
