import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { type CreatureStats as Stats, STAT_AXES, statPoint } from '@/utils/creature-stats';

const LABELS = [
  { x: 180, y: 24, anchor: 'middle', lines: ['Health'] },
  { x: 278, y: 108, anchor: 'start', lines: ['Attack'] },
  { x: 278, y: 220, anchor: 'start', lines: ['Defense'] },
  { x: 180, y: 304, anchor: 'middle', lines: ['Speed'] },
  { x: 82, y: 204, anchor: 'end', lines: ['Spl', 'Defense'] },
  { x: 82, y: 92, anchor: 'end', lines: ['Spl', 'Attack'] },
] as const;

export function CreatureStats({ stats, fontFamily }: { stats: Stats; fontFamily?: string }) {
  const vertices = STAT_AXES.map((_, index) => statPoint(index, 140));
  const points = STAT_AXES.map(({ key }, index) => statPoint(index, stats[key]));
  const polygon = (points: { x: number; y: number }[]) => points.map(({ x, y }) => `${x},${y}`).join(' ');
  const summary = STAT_AXES.map(({ key, label }) => `${label}: ${stats[key]} out of 140`).join('. ');

  return (
    <View testID="creature-stats-panel" style={{ borderWidth: 2, borderColor: '#ffedf6', borderRadius: 12,
      overflow: 'hidden', backgroundColor: '#f6d6e6', boxShadow: '0 3px 0 #9e7f9d' }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 15, backgroundColor: '#eaa3c5', borderBottomWidth: 2, borderBottomColor: '#ffd8e9' }}>
        <Text accessibilityRole="header" style={{ fontFamily, color: '#693650', fontSize: 11, lineHeight: 20 }}>STATS</Text>
      </View>
      <View style={{ margin: 10, borderWidth: 1, borderColor: '#dcabc7', borderRadius: 6, backgroundColor: '#fce7ef' }}>
        <View testID="creature-stats-chart" accessibilityRole="image" accessibilityLabel={summary}
          style={{ width: '100%', aspectRatio: 360 / 346 }}>
          <Svg width="100%" height="100%" viewBox="0 0 360 346" pointerEvents="none"
            aria-hidden>
            <Polygon testID="stats-hexagon" points={polygon(vertices)} fill="#9ce784" stroke="#28934d" strokeWidth="2.5" />
            <Polygon testID="stats-midpoint" points={polygon(STAT_AXES.map((_, index) => statPoint(index, 70)))}
              fill="none" stroke="#4fb75e" strokeWidth="1.5" />
            {vertices.map(({ x, y }, index) => <Line key={index} x1="180" y1="170" x2={x} y2={y} stroke="#38a557" strokeWidth="1.2" />)}
            <Polygon testID="stats-values-polygon" points={polygon(points)} fill="#258be4" fillOpacity={0.7} stroke="#1469bb" strokeWidth="2.5" />
            {points.map(({ x, y }, index) => <Circle testID={`stat-point-${STAT_AXES[index].key}`} key={index}
              cx={x} cy={y} r="3" fill="#125da9" />)}
            <Circle cx="180" cy="170" r="2" fill="#185d78" />
            {STAT_AXES.map(({ key }, index) => {
              const { x, y, anchor, lines } = LABELS[index];
              return <G key={key} fontFamily={fontFamily} fontWeight="400" textAnchor={anchor} fill="#4f3d54">
                {lines.map((line, row) => <SvgText key={line} x={x} y={y + row * 16} fontSize="11">{line}</SvgText>)}
                <SvgText testID={`stat-value-${key}`} x={x} y={y + lines.length * 16 + 8} fontSize="14" fill="#176ac1">{stats[key]}</SvgText>
              </G>;
            })}
          </Svg>
        </View>
      </View>
    </View>
  );
}
