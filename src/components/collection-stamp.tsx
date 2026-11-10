import { Text, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { useStampStyle } from '@/hooks/use-collection-stamps';
import { formatStatsCount, type StatsLanguage } from '@/utils/stats-language';

export function CollectionStamp({ label, count, color, backgroundColor, clock, index, reduced, fontFamily, testID, language = 'en' }: {
  label: string; count: number; color: string; backgroundColor: string; clock: SharedValue<number>;
  index: number; reduced: boolean; fontFamily?: string; testID: string; language?: StatsLanguage;
}) {
  const stampStyle = useStampStyle(clock, index, reduced);
  return <View style={{ paddingVertical: 5, paddingHorizontal: 2 }}>
    <Animated.View testID={testID} accessible accessibilityLanguage={language === 'hi' ? 'hi-IN' : 'en'} accessibilityLabel={`${label}: ${formatStatsCount(count, language)}`}
      style={[{ minHeight: index === 0 ? 80 : 60, borderWidth: 3, borderColor: color, borderRadius: 6,
        backgroundColor, paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'center',
        boxShadow: '0 3px 0 #183a5055' }, stampStyle]}>
      <Text selectable style={{ fontFamily, color, fontSize: index === 0 ? 20 : 16, lineHeight: language === 'hi' ? (index === 0 ? 34 : 30) : (index === 0 ? 30 : 26), textAlign: 'center' }}>
        {label}: {formatStatsCount(count, language)}
      </Text>
    </Animated.View>
  </View>;
}
