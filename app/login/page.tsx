'use client' // Necessary for interaction/state

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Database } from '@/lib/database.types'; // We'll create this type later

export default function LoginPage() {
  // Use the type-safe client (Optional: We can skip the 'Database' type for now if it's causing errors, but this is best practice)
  const supabase = createClientComponentClient<Database>(); 

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-3 rounded-xl bg-white shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Sign In to The Friday Recap
        </h1>
        {/* The Supabase Auth UI handles sign-up, login, and password reset */}
        <Auth
          supabaseClient={supabase}
          view="sign_in" 
          appearance={{ theme: ThemeSupa }}
          theme="default"
          redirectTo={`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/auth/callback`}
        />
      </div>
    </div>
  )
}