import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { ARTWORK, FRAME_CLIP, OPENED_STILL } from '@/constants/artwork';

export function RotomFrame() {
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox={`0 0 ${ARTWORK.width} ${ARTWORK.height}`}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Defs>
        <ClipPath id="rotom-frame">
          <Path d={FRAME_CLIP} clipRule="evenodd" fillRule="evenodd" />
        </ClipPath>
      </Defs>
      <Image
        href={OPENED_STILL}
        width={ARTWORK.width}
        height={ARTWORK.height}
        clipPath="url(#rotom-frame)"
      />
    </Svg>
  );
}
