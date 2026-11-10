import { Pressable, Text, View } from 'react-native';

type NoticeProps = {
  title: string;
  detail?: string;
  action?: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function Notice({ title, detail, action, onPress, disabled }: NoticeProps) {
  return (
    <View style={{ alignItems: 'center', gap: 14, padding: 20, width: '100%' }}>
      <Text selectable accessibilityRole="header" style={{ color: '#8af2ff', fontSize: 20, fontWeight: '600', textAlign: 'center' }}>
        {title}
      </Text>
      {detail ? (
        <Text selectable style={{ color: '#d3e7eb', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{detail}</Text>
      ) : null}
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => ({
            minHeight: 48,
            paddingVertical: 12,
            paddingHorizontal: 22,
            borderRadius: 24,
            backgroundColor: pressed ? '#86efff' : '#2cd3ed',
            opacity: disabled ? 0.5 : 1,
            justifyContent: 'center',
          })}
        >
          <Text style={{ color: '#00242b', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
