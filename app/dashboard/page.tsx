// app/dashboard/page.tsx (Updated)

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import WatchlistForm from '@/components/WatchlistForm'; // <-- NEW IMPORT

export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies });
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // If the user has a session, we display the page content
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">Welcome Back, {session.user.email}! 👋</h1>
      <p className="text-lg text-gray-700 mb-8">
        Manage your holdings and watchlist below.
      </p>

      {/* 1. Add Stock Form */}
      <WatchlistForm />

      {/* 2. Display Holdings and Watchlist (Next Step) */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Your Portfolio Summary</h2>
        <p className="text-gray-600">
            *Your stocks will appear here in the next step!*
        </p>
      </div>

    </div>
  );
}