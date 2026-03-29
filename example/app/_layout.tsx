import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f0f0f' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0f0f0f' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'VideoSuite Demo' }} />
        <Stack.Screen name="player/[bvid]" options={{ title: '播放' }} />
        <Stack.Screen name="live/[roomId]" options={{ title: '直播' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
