import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, useWindowDimensions, View } from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image, useImage } from 'expo-image';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { BackCamera } from '@/components/back-camera';
import { Notice } from '@/components/notice';
import { ARTWORK, OPENED_STILL, OPENING_AUDIO, OPENING_VIDEO } from '@/constants/artwork';

type Phase = 'black' | 'opening' | 'open';

export function RotomScreen({ onRetry, focused = true }: { onRetry: () => void; focused?: boolean }) {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / ARTWORK.width, height / ARTWORK.height);
  const [phase, setPhase] = useState<Phase>('black');
  const [foreground, setActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const active = foreground && focused;
  const [blackFinished, setBlackFinished] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [handoffFinished, setHandoffFinished] = useState(false);
  const reduced = useReducedMotion();
  const introOpacity = useSharedValue(1);
  const handleFrameReady = useCallback(() => setFrameReady(true), []);
  const [audioReady, setAudioReady] = useState(false);
  const [loadError, setError] = useState<string | null>(null);
  // Decode once and share the ready bitmap with both layers. Cached Android
  // image views can skip load callbacks, which must not gate the whole app.
  const openedImage = useImage(OPENED_STILL, {
    maxWidth: ARTWORK.width,
    maxHeight: ARTWORK.height,
    onError: () => setError('The Rotom frame could not load.'),
  });
  const imageReady = openedImage !== null;
  const started = useRef(false);
  const audio = useAudioPlayer(OPENING_AUDIO, { downloadFirst: true });
  const audioStatus = useAudioPlayerStatus(audio);
  // Browsers may block audible autoplay. The video/camera must still open.
  const autoplayBlocked = process.env.EXPO_OS === 'web' && /notallowed|not allowed|user.*interact|play\(\).*failed/i.test(audioStatus.error ?? '');
  const error = loadError ?? (audioStatus.error && !autoplayBlocked ? 'The opening sound could not load.' : null);
  const video = useVideoPlayer(OPENING_VIDEO, (player) => {
    player.loop = false;
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
  });
  const { status: videoStatus } = useEvent(video, 'statusChange', { status: video.status });

  useEventListener(video, 'playToEnd', () => setPhase('open'));
  useEventListener(video, 'statusChange', ({ status }) => {
    if (status === 'error') setError('The opening video could not load.');
  });

  useEffect(() => {
    let mounted = true;
    const blackTimer = setTimeout(() => setBlackFinished(true), 450);
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false })
      .then(() => { if (mounted) setAudioReady(true); })
      .catch(() => { if (mounted) setError('The opening sound could not be prepared.'); });
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => {
      mounted = false;
      clearTimeout(blackTimer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'black' || error || !active) return;
    const timeout = setTimeout(() => setError('The opening media is taking too long to load.'), 15000);
    return () => clearTimeout(timeout);
  }, [phase, error, active]);

  useEffect(() => {
    if (started.current || phase !== 'black' || error || !active || !blackFinished || !imageReady || !audioReady) return;
    const startWhenReady = () => {
      // A native player can become ready before React subscribes to its event.
      // Read its actual state, including when no new status event is emitted.
      if (started.current || !audio.isLoaded || video.status !== 'readyToPlay') return;
      started.current = true;
      setPhase('opening');
      audio.play();
      video.play();
    };
    startWhenReady();
    const timer = setInterval(startWhenReady, 100);
    return () => clearInterval(timer);
  }, [active, audio, audioReady, audioStatus.isLoaded, blackFinished, error, imageReady, phase, video, videoStatus]);

  useEffect(() => {
    if (!started.current) return;
    if (!active || error) {
      video.pause();
      audio.pause();
    } else {
      if (phase === 'opening') video.play();
      // Let the 1.58s sound finish over the still after the 1s video ends.
      if (audio.isLoaded && audio.currentTime < audio.duration) audio.play();
    }
  }, [active, audio, error, phase, video]);

  useEffect(() => {
    if (phase !== 'open' || !frameReady || !active || error || handoffFinished) return;
    const duration = reduced ? 120 : 220;
    introOpacity.set(withTiming(0, { duration, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.Never }));
    // Retain the ended video surface until the already-rendered frame is revealed.
    const timer = setTimeout(() => setHandoffFinished(true), duration + 40);
    return () => { clearTimeout(timer); cancelAnimation(introOpacity); };
  }, [active, error, frameReady, handoffFinished, introOpacity, phase, reduced]);
  const introStyle = useAnimatedStyle(() => ({ opacity: introOpacity.get() }));

  return (
    <View
      testID={`rotom-${phase}`}
      style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}
      onLayout={() => { void SplashScreen.hideAsync(); }}
    >
      <StatusBar hidden />
      {process.env.EXPO_OS === 'android' ? <NavigationBar hidden /> : null}
      <View style={{ position: 'absolute', inset: 0 }} pointerEvents={phase === 'open' ? 'auto' : 'none'} accessibilityElementsHidden={phase !== 'open'} importantForAccessibility={phase === 'open' ? 'auto' : 'no-hide-descendants'}>
        <BackCamera active={active && phase === 'open'} openedImage={openedImage} onFrameReady={handleFrameReady} />
      </View>
      {!handoffFinished ? (
        <Animated.View testID="intro-handoff" style={[{ position: 'absolute', inset: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }, introStyle]}>
          <View style={{ width: ARTWORK.width * scale, height: ARTWORK.height * scale, backgroundColor: '#000' }}>
            <Image
              source={openedImage}
              style={{ position: 'absolute', inset: 0 }}
              contentFit="contain"
              transition={0}
              onError={() => setError('The Rotom frame could not load.')}
            />
            <VideoView
              testID="opening-video"
              player={video}
              nativeControls={false}
              contentFit="contain"
              surfaceType="textureView"
              playsInline
              fullscreenOptions={{ enable: false }}
              allowsPictureInPicture={false}
              style={{ position: 'absolute', inset: 0, opacity: phase === 'black' ? 0 : 1 }}
            />
            {phase === 'black' || error ? (
              <View style={{ position: 'absolute', inset: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                {error ? (
                  <Notice title="Rotom needs another try" detail={error} action="Retry opening" onPress={onRetry} />
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
