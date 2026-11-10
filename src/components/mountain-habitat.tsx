import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';

// A vector landscape keeps the handheld's stepped pixel edges crisp at any size.
export function MountainHabitat({ miniature = false }: { miniature?: boolean }) {
  return <Svg testID="mountain-habitat" pointerEvents="none" width="100%" height="100%" viewBox={miniature ? '0 35 360 150' : '0 0 360 420'} preserveAspectRatio="none"
    style={{ position: 'absolute', inset: 0 }} aria-hidden>
    <Defs>
      <Pattern id={miniature ? 'mini-terrain' : 'terrain'} width="24" height="24" patternUnits="userSpaceOnUse">
        <Rect width="24" height="24" fill="#c7b5d6" />
        <Rect x="4" y="5" width="3" height="2" fill="#b4a2c8" />
        <Rect x="16" y="17" width="4" height="2" fill="#dfcfe5" />
      </Pattern>
    </Defs>
    <Rect width="360" height="420" fill="#9cdaea" />
    <Rect y="50" width="360" height="58" fill="#b9e8ec" />
    <G fill="#f0f9ee" opacity={0.8}>
      <Path d="M16 36h19v-7h26v7h19v10H16Z M248 24h16v-6h31v6h24v10h-71Z M159 65h14v-6h22v6h17v8h-53Z" />
    </G>
    <Path d="M0 166V137h18v-15h18v-18h18V87h18v18h18v19h18v-15h18V91h18V70h18V47h18v25h18v22h18v22h18v17h18v-22h18V92h18V72h18v22h18v22h18v18h18v20h18v20H0Z" fill="#a6b3cc" />
    <Path d="M0 206v-28h18v-23h18v-23h18v-23h18v28h18v21h18v22h18v-27h18v-26h18v-28h18V70h18v30h18v26h18v25h18v27h18v-20h18v-26h18v-25h18V86h18v27h18v24h18v22h18v28h18v24Z" fill="#7e8da9" />
    <Path d="M36 155v-23h18v-23h18v28h18v21H72v-12H54v9Z M144 127V99h18V70h18v30h18v26h-18v-13h-18v14Z M270 132v-25h18V86h18v27h18v24h-18v-13h-18v8Z" fill="#edf3ec" />
    <Path d="M0 209h18v-11h36v10h36v-10h36v17h36v-10h36v-9h36v12h36v-8h36v15h36v-8h18v213H0Z" fill="#9ca6b5" />
    <Path d="M0 245h36v-9h36v14h36v-10h36v13h36v-9h36v12h36v-12h36v15h36v-13h36v174H0Z" fill={miniature ? '#c7b5d6' : 'url(#terrain)'} />
    <Path d="M0 354h36v-7h36v8h36v-8h36v8h36v-7h36v10h36v-9h36v10h36v-8h36v69H0Z" fill="#c0a9d0" opacity={0.6} />
    <G fill="#eee2e8" opacity={0.75}>
      <Path d="M20 300h9v3h-9Z M125 280h12v3h-12Z M286 318h12v3h-12Z M77 394h13v3H77Z M222 380h10v3h-10Z" />
    </G>
  </Svg>;
}
