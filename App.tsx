import { useState } from 'react';
import { useIsFocused } from 'expo-router';
import { RotomScreen } from '@/screens/rotom-screen';

export default function App() {
  const [session, setSession] = useState(0);
  const focused = useIsFocused();
  return <RotomScreen key={session} focused={focused} onRetry={() => setSession((value) => value + 1)} />;
}
