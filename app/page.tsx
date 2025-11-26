import { redirect } from 'next/navigation';

export default function Home() {
  // Immediately redirect users from the root URL to the login page.
  redirect('/login');
}