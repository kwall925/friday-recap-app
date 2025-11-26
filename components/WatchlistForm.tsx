'use client'

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Import the client utility

export default function WatchlistForm() {
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState<'holding' | 'watchlist'>('watchlist');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    if (!ticker) {
      setMessage('Please enter a stock ticker.');
      setLoading(false);
      return;
    }

    // 1. Check if user is logged in (optional but good security)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setMessage('Error: User not logged in.');
        setLoading(false);
        return;
    }

    // 2. Insert data into the 'user_stocks' table
    const { error } = await supabase
      .from('user_stocks')
      .insert({
        user_id: user.id,
        ticker: ticker.toUpperCase().trim(),
        category: category,
      });

    if (error) {
      console.error('Supabase Error:', error);
      setMessage(`Error saving stock: ${error.message}`);
    } else {
      setMessage(`Successfully added ${ticker.toUpperCase()} to your ${category}.`);
      setTicker('');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Add Stock to Portfolio</h2>

      <div className="flex space-x-4">
        {/* Ticker Input */}
        <div className="flex-grow">
          <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">Stock Ticker (e.g., AAPL)</label>
          <input
            type="text"
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
            placeholder="GOOG, TSLA, etc."
            required
            disabled={loading}
          />
        </div>
        
        {/* Category Selector */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as 'holding' | 'watchlist')}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
            disabled={loading}
          >
            <option value="watchlist">Watchlist</option>
            <option value="holding">Holding</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
      >
        {loading ? 'Adding...' : 'Add Stock'}
      </button>
      
      {message && (
        <p className={`text-sm font-medium ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}