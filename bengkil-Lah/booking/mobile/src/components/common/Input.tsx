import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Typography } from '../../utils/theme';

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  containerStyle?: ViewStyle;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}

export const Input: React.FC<Props> = ({
  label, value, onChangeText, placeholder, secureTextEntry,
  keyboardType, autoCapitalize = 'none', error, multiline,
  numberOfLines, editable = true, containerStyle, leftIcon,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputWrapper,
        focused && styles.focused,
        error && styles.errorBorder,
        !editable && styles.disabled,
      ]}>
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={Colors.textSecondary} style={styles.leftIcon} />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.multiline]}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { ...Typography.bodySmall, color: Colors.text, fontWeight: '500', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
  },
  focused: { borderColor: Colors.primary },
  errorBorder: { borderColor: Colors.danger },
  disabled: { backgroundColor: Colors.background },
  leftIcon: { marginRight: 8 },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    paddingVertical: 13,
    minHeight: 48,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  eyeBtn: { padding: 4 },
  error: { ...Typography.caption, color: Colors.danger, marginTop: 4 },
});
