import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useFonts } from 'expo-font';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Image, type ImageRef } from 'expo-image';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { ARTWORK, CAPTURE_AUDIO, FLASH_AUDIO, IDENTIFIED_AUDIO } from '@/constants/artwork';
import { Notice } from '@/components/notice';
import { RotomFrame } from '@/components/rotom-frame';
import { CaptureEdgeLoader, type CaptureProgress } from '@/components/capture-edge-loader';
import { CaptureButton } from '@/components/capture-button';
import { useCaptureEffects } from '@/hooks/use-capture-effects';
import { savePhoto, syncPhoto } from '@/utils/save-photo';
import { type Recognition } from '@/utils/recognition';
import { RecognitionCelebration } from '@/components/recognition-celebration';
import { CreatureEntry } from '@/components/creature-entry';
import { CreatureReveal } from '@/components/creature-reveal';
import { PokedexCurtains } from '@/components/pokedex-curtains';
import { CRY_AUDIO } from '@/constants/creature-cries';
import { POKEDEX_FONTS } from '@/constants/typography';
import { usePokedex } from '@/providers/pokedex-provider';

export function BackCamera({ active, openedImage, onFrameReady }: { active: boolean; openedImage: ImageRef | null; onFrameReady?: () => void }) {
  const { playMenuOpenSound } = usePokedex();
  // Warm the entry font during the intro without adding another startup gate.
  useFonts(POKEDEX_FONTS);
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / ARTWORK.width, height / ARTWORK.height);
  const artworkWidth = ARTWORK.width * scale;
  const artworkHeight = ARTWORK.height * scale;
  const left = (width - artworkWidth) / 2;
  const top = (height - artworkHeight) / 2;
  const artworkStyle = { position: 'absolute' as const, left, top, width: artworkWidth, height: artworkHeight };
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);
  const permissionRequested = useRef(false);
  const camera = useRef<CameraView>(null);
  const captureLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<CaptureProgress>('idle');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ fileName: string; localUri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const stillReady = openedImage !== null;
  const reduced = useReducedMotion();
  const stillOpacity = useSharedValue(1);
  const [attempt, setAttempt] = useState(0);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [curtains, setCurtains] = useState(false);
  const revealEntry = useCallback(() => setEntryOpen(true), []);
  const finishCurtains = useCallback(() => setCurtains(false), []);
  const activeRef = useRef(active);
  const finishCelebration = useCallback(() => setCelebrating(false), []);
  const shutter = useAudioPlayer(CAPTURE_AUDIO, { downloadFirst: true });
  const caughtSound = useAudioPlayer(IDENTIFIED_AUDIO, { downloadFirst: true });
  const flashSound = useAudioPlayer(FLASH_AUDIO, { downloadFirst: true });
  const selectedCry = recognition?.status === 'recognized' ? recognition.creature?.cry : undefined;
  const crySound = useAudioPlayer(selectedCry ? CRY_AUDIO[selectedCry] : null, { downloadFirst: true });
  const crySoundEpoch = useRef(0);
  const flashSoundEpoch = useRef(0);
  const caughtSoundEpoch = useRef(0);
  const viewport = { left: left + 74 * scale, top: top + 146 * scale, width: 387 * scale, height: 763 * scale };
  const effects = useCaptureEffects({ width, height, viewport });
  const { reset } = effects;
  const handleRevealError = useCallback(() => {
    setDisplayUri(null);
    setRecognition({ status: 'unavailable' });
    reset();
  }, [reset]);
  const blocked = permission?.canAskAgain === false ||
    (process.env.EXPO_OS === 'web' && permission?.status === 'denied');

  useEffect(() => () => {
    if (process.env.EXPO_OS === 'web' && displayUri?.startsWith('blob:')) URL.revokeObjectURL(displayUri);
  }, [displayUri]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
      else setReady(false);
    });
    return () => subscription.remove();
  }, [getPermission]);

  useEffect(() => {
    activeRef.current = active;
    const timer = !active ? setTimeout(finishCelebration, 0) : undefined;
    if (!active) {
      reset();
      shutter.pause();
      caughtSoundEpoch.current++;
      caughtSound.pause();
      crySoundEpoch.current++;
      crySound.pause();
      flashSoundEpoch.current++;
      flashSound.pause();
    }
    return () => { clearTimeout(timer); activeRef.current = false; };
  }, [active, caughtSound, crySound, finishCelebration, flashSound, reset, shutter]);

  async function enableCamera() {
    setRequesting(true);
    setError(null);
    try {
      if (blocked) {
        if (process.env.EXPO_OS === 'web') {
          setError('Allow camera access in your browser’s site settings, then reload this page.');
        } else {
          await Linking.openSettings();
        }
      } else {
        await requestPermission();
      }
    } catch {
      setError('Camera access could not be requested. Check your device settings and try again.');
    } finally {
      setRequesting(false);
    }
  }

  useEffect(() => {
    if (!active || !permission || permission.granted || blocked || permissionRequested.current) return;
    permissionRequested.current = true;
    void requestPermission().catch(() => setError('Camera access could not be requested.'));
  }, [active, permission, blocked, requestPermission]);

  function playShutter() {
    // Replay from the start on every committed capture, including subsequent shots.
    shutter.pause();
    void shutter.seekTo(0).then(() => {
      if (AppState.currentState === 'active') shutter.play();
    }).catch(() => undefined);
  }

  const playCaughtSound = useCallback(() => {
    const epoch = ++caughtSoundEpoch.current;
    caughtSound.pause();
    void caughtSound.seekTo(0).then(() => {
      if (epoch === caughtSoundEpoch.current && activeRef.current && AppState.currentState === 'active') caughtSound.play();
    }).catch(() => undefined);
  }, [caughtSound]);

  const playFlashSound = useCallback(() => {
    const epoch = ++flashSoundEpoch.current;
    flashSound.pause();
    void flashSound.seekTo(0).then(() => {
      if (epoch === flashSoundEpoch.current && activeRef.current && AppState.currentState === 'active') flashSound.play();
    }).catch(() => undefined);
  }, [flashSound]);

  const playCry = useCallback(() => {
    if (!selectedCry) return;
    const epoch = ++crySoundEpoch.current;
    crySound.pause();
    void crySound.seekTo(0).then(() => {
      if (epoch === crySoundEpoch.current && activeRef.current && AppState.currentState === 'active') crySound.play();
    }).catch(() => undefined);
  }, [crySound, selectedCry]);

  const openEntry = useCallback(() => {
    playMenuOpenSound();
    setCurtains(true);
    setCelebrating(false);
  }, [playMenuOpenSound]);

  const celebrateReveal = useCallback(() => {
    playCaughtSound();
    setCelebrating(true);
  }, [playCaughtSound]);

  async function capture() {
    if (!camera.current || !ready || captureLock.current || pending) return;
    captureLock.current = true;
    effects.begin();
    playShutter();
    setSaving(true);
    setProgress('working');
    setCaptureError(null);
    setRecognition(null);
    setDisplayUri(null);
    setCelebrating(false);
    setEntryOpen(false);
    setCurtains(false);
    let recognized = false;
    let creatureReady = false;
    const takenAt = new Date();
    try {
      const picture = await camera.current.takePictureAsync({ quality: 1, imageType: 'jpg', shutterSound: false });
      if (!picture) throw new Error('No photo was returned.');
      // Keep the original cache URI for display; saving copies it before processing.
      setCapturedUri(picture.uri);
      setReady(false);
      const result = await savePhoto(picture.uri, takenAt);
      setProgress(result.synced ? 'saved' : 'failed');
      if (result.synced) {
        setRecognition(result.recognition);
        setDisplayUri(result.displayUri);
        recognized = result.recognition.status === 'recognized';
        creatureReady = result.recognition.status === 'recognized' && !!result.recognition.creature;
      }
      if (!result.synced) {
        setPending(result);
        setCaptureError('Could not save the photo. Your capture is waiting for retry.');
      }
    } catch {
      setProgress('failed');
      setCaptureError('Could not capture the photo. Try again.');
    } finally {
      await effects.finish(creatureReady);
      captureLock.current = false;
      setSaving(false);
      if (recognized && activeRef.current) {
        if (!creatureReady) setCelebrating(true);
      }
    }
  }

  async function retrySave() {
    if (!pending || captureLock.current) return;
    captureLock.current = true;
    setSaving(true);
    setProgress('working');
    setCaptureError(null);
    effects.resumeProcessing();
    let recognized = false;
    let creatureReady = false;
    try {
      const result = await syncPhoto(pending.localUri, pending.fileName);
      if (result.synced) {
        setPending(null);
        setProgress('saved');
        setRecognition(result.recognition);
        setDisplayUri(result.displayUri);
        recognized = result.recognition.status === 'recognized';
        creatureReady = result.recognition.status === 'recognized' && !!result.recognition.creature;
      } else {
        setProgress('failed');
        setCaptureError('Could not save the photo. Check the computer connection and retry.');
      }
    } finally {
      await effects.finish(creatureReady);
      captureLock.current = false;
      setSaving(false);
      if (recognized && activeRef.current) {
        if (!creatureReady) setCelebrating(true);
      }
    }
  }

  function retake() {
    if (captureLock.current || pending) return;
    caughtSoundEpoch.current++;
    caughtSound.pause();
    crySoundEpoch.current++;
    crySound.pause();
    flashSoundEpoch.current++;
    flashSound.pause();
    effects.reset();
    setReady(false);
    setCapturedUri(null);
    setProgress('idle');
    setCaptureError(null);
    setRecognition(null);
    setDisplayUri(null);
    setCelebrating(false);
    setEntryOpen(false);
    setCurtains(false);
    setAttempt((value) => value + 1);
  }

  const mountCamera = active && permission?.granted && !error && !capturedUri;
  const showViewfinder = (ready && mountCamera) || !!capturedUri;
  const viewfinderStyle = {
    position: 'absolute' as const,
    ...viewport,
    overflow: 'hidden' as const, backgroundColor: '#000',
  };

  useEffect(() => {
    if (stillReady) onFrameReady?.();
  }, [onFrameReady, stillReady]);

  useEffect(() => {
    stillOpacity.set(withTiming(showViewfinder && stillReady ? 0 : 1, {
      duration: reduced ? 120 : 180, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.Never,
    }));
  }, [reduced, showViewfinder, stillOpacity, stillReady]);
  const stillStyle = useAnimatedStyle(() => ({ opacity: stillOpacity.get() }));

  useEffect(() => {
    if (!mountCamera || ready) return;
    const timer = setTimeout(() => setError('The camera did not become ready. Check that it is available and try again.'), 10000);
    return () => clearTimeout(timer);
  }, [mountCamera, ready, attempt]);

  const revealReady = !saving && displayUri && recognition?.status === 'recognized' && recognition.creature
    ? { imageUri: displayUri, creature: recognition.creature, object: recognition.label } : null;
  const expandedScene = saving || !!revealReady;
  return (
    <>
    <View pointerEvents={curtains ? 'none' : 'auto'} aria-hidden={curtains}
      accessibilityElementsHidden={curtains} importantForAccessibility={curtains ? 'no-hide-descendants' : 'auto'}
      style={{ position: 'absolute', inset: 0 }}>
    {revealReady && entryOpen ? <CreatureEntry {...revealReady} onRetake={retake} onPlayCry={playCry} onOpenPokedex={() => { playMenuOpenSound(); retake(); router.push('/pokedex'); }} /> : <>
    <View testID="opened-rotom" pointerEvents={revealReady ? 'none' : 'auto'}
      aria-hidden={!!revealReady}
      accessibilityElementsHidden={!!revealReady} importantForAccessibility={revealReady ? 'no-hide-descendants' : 'auto'}
      style={{ position: 'absolute', inset: 0, backgroundColor: '#000', overflow: 'hidden' }}>
      {mountCamera ? (
        <View testID="back-camera" accessibilityLabel="Live back camera" style={viewfinderStyle}>
          <CameraView
            key={attempt}
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            mode="picture"
            mirror={false}
            animateShutter={false}
            onCameraReady={() => setReady(true)}
            onMountError={() => {
              setReady(false);
              setError('The back camera could not start. Close other camera apps and try again.');
            }}
          />
        </View>
      ) : null}

      {capturedUri ? (
        <Animated.View testID="capture-photo-plane" pointerEvents="none" style={expandedScene ? [{ position: 'absolute', inset: 0 }, effects.photoStyle] : viewfinderStyle}>
          <Image onDisplay={() => { if (saving) effects.expand(); }} testID="captured-photo" source={{ uri: !expandedScene && displayUri ? displayUri : capturedUri }} style={{ position: 'absolute', inset: 0 }} contentFit={!expandedScene && displayUri ? 'contain' : 'cover'} transition={0} />
        </Animated.View>
      ) : null}

      {capturedUri && saving ? <View testID="capture-bezel" pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        <Animated.View testID="capture-bezel-top" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: viewport.top, backgroundColor: '#000' }, effects.bezelTopStyle]} />
        <Animated.View testID="capture-bezel-bottom" style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height - viewport.top - viewport.height, backgroundColor: '#000' }, effects.bezelBottomStyle]} />
        <Animated.View testID="capture-bezel-left" style={[{ position: 'absolute', left: 0, top: viewport.top, width: viewport.left, height: viewport.height, backgroundColor: '#000' }, effects.bezelLeftStyle]} />
        <Animated.View testID="capture-bezel-right" style={[{ position: 'absolute', right: 0, top: viewport.top, width: width - viewport.left - viewport.width, height: viewport.height, backgroundColor: '#000' }, effects.bezelRightStyle]} />
      </View> : null}

      <Animated.View testID="rotom-capture-frame" pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, effects.frameStyle]}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: top, backgroundColor: '#000' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: top, backgroundColor: '#000' }} />
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: left, backgroundColor: '#000' }} />
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: left, backgroundColor: '#000' }} />
        <View style={artworkStyle}>
          <RotomFrame />
          <Animated.View pointerEvents="none" testID="rotom-still-cover" style={[{ position: 'absolute', inset: 0 }, stillStyle]}>
            <Image source={openedImage} style={{ position: 'absolute', inset: 0 }} contentFit="contain" transition={0} />
          </Animated.View>
        </View>
      </Animated.View>

      {!saving && !pending && !revealReady ? <View pointerEvents="box-none" style={artworkStyle}>
          <Pressable accessibilityRole="button" accessibilityLabel="View saved Pokédex" onPress={() => router.push('/pokedex')}
            style={({ pressed }) => ({ position: 'absolute', right: '18%', top: '16%', minHeight: 44, minWidth: 92, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: '#a3e7ef', borderRadius: 7, backgroundColor: '#062331e8', opacity: pressed ? 0.65 : 1 })}>
            <Text style={{ color: '#dcf5e8', fontFamily: 'PokedexPixel', fontSize: 12 }}>POKÉDEX</Text>
          </Pressable>
        </View> : null}
      {showViewfinder ? (
        <View pointerEvents="box-none" style={artworkStyle}>
          <View style={{ position: 'absolute', left: '19%', right: '19%', bottom: '8%', alignItems: 'center', gap: 8 }}>
            {!saving && recognition && !(recognition.status === 'recognized' && recognition.creature && displayUri) ? (
              <Text testID="recognition-result" accessibilityLiveRegion="polite" style={{ color: recognition.status === 'recognized' ? '#ffe477' : '#d4eff2', backgroundColor: '#001014ed', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, textAlign: 'center', fontSize: 17, fontWeight: '700' }}>
                {recognition.status === 'recognized' ? recognition.label.charAt(0).toUpperCase() + recognition.label.slice(1) : recognition.status === 'uncertain' ? 'Not sure yet. Try another angle.' : 'Photo saved. Creature unavailable. Try again later.'}
              </Text>
            ) : null}
            {captureError ? (
              <Text selectable accessibilityLiveRegion="polite" style={{ color: '#fff', backgroundColor: '#001014dd', borderRadius: 12, padding: 8, textAlign: 'center', fontSize: 12 }}>{captureError}</Text>
            ) : null}
            {pending ? (
              <Pressable accessibilityRole="button" onPress={() => void retrySave()} disabled={saving} style={{ minHeight: 44, padding: 12, backgroundColor: '#001014e8', borderRadius: 22 }}>
                <Text style={{ color: '#8af2ff', fontWeight: '700' }}>Retry save</Text>
              </Pressable>
            ) : null}
            <CaptureButton
              label={capturedUri ? 'Retake photo' : 'Capture photo'}
              disabled={saving || !!pending}
              busy={saving}
              onPress={() => capturedUri ? retake() : void capture()}
              onPressIn={effects.pressIn}
              onPressOut={effects.pressOut}
              ballStyle={effects.ballStyle}
              shadeStyle={effects.shadeStyle}
              waveStyle={effects.waveStyle}
            />
          </View>
        </View>
      ) : null}

      {(error || (permission && !permission.granted && permission.status === 'denied')) ? (
        <View pointerEvents="box-none" style={artworkStyle}>
          <View style={{ position: 'absolute', left: '17%', right: '17%', top: '34%', bottom: '18%', justifyContent: 'center' }}>
            <View style={{ backgroundColor: '#001014ed', borderRadius: 20 }}>
              {error && permission?.granted ? (
                <Notice title="Camera unavailable" detail={error} action="Try again" onPress={() => { setError(null); setReady(false); setAttempt((value) => value + 1); }} />
              ) : permission ? (
                <Notice
                  title="Camera access denied"
                  detail={error ?? 'Allow camera access in settings to use the viewfinder.'}
                  action={requesting ? 'Opening…' : blocked ? 'Open settings' : 'Retry permission'}
                  disabled={requesting}
                  onPress={() => void enableCamera()}
                />
              ) : <Notice title="Checking camera access…" />}
            </View>
          </View>
        </View>
      ) : null}
      <CaptureEdgeLoader phase={progress} active={active} />
      <Animated.View testID="capture-scene-dim" pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: '#000' }, effects.dimStyle]} />
    </View>
    {revealReady ? <CreatureReveal imageUri={revealReady.imageUri} name={revealReady.creature.name} active={active}
      celebration={active && celebrating ? <RecognitionCelebration onComplete={finishCelebration} /> : null}
      onCry={playCry} onFlashStart={playFlashSound} onRevealed={celebrateReveal} onOpen={openEntry} onImageError={handleRevealError} /> : null}
    {!revealReady && active && celebrating ? <RecognitionCelebration onComplete={finishCelebration} /> : null}
    </>}
    </View>
    {curtains ? <PokedexCurtains active={active} entryReady={entryOpen} onCovered={revealEntry} onComplete={finishCurtains} /> : null}
    </>
  );
}
