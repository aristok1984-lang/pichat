import React, { Suspense } from 'react';
import ChatsScreen from './components/ChatsScreen';

export default function ChatsPage() {
  return (
    <Suspense fallback={null}>
      <ChatsScreen />
    </Suspense>
  );
}