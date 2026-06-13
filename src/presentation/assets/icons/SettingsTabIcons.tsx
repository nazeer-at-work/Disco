import React from 'react';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { ChevronDownIconProps } from '../../screens/SettingsTabScreen.types';

export function ChevronRightIcon() {
  return <MaterialIcons name="arrow-forward-ios" size={16} color="#64748B" />;
}

export function ChevronDownIcon({ expanded }: ChevronDownIconProps) {
  return (
    <MaterialIcons
      name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
      size={22}
      color="#64748B"
    />
  );
}

export function RowUserIcon() {
  return <MaterialIcons name="person-outline" size={22} color="#132A67" />;
}

export function RowMoonIcon() {
  return <MaterialIcons name="dark-mode" size={22} color="#132A67" />;
}

export function RowPenIcon() {
  return <MaterialIcons name="edit" size={22} color="#132A67" />;
}

export function RowShieldIcon() {
  return <MaterialIcons name="verified-user" size={22} color="#132A67" />;
}

export function RowBellIcon() {
  return <MaterialIcons name="notifications-none" size={22} color="#132A67" />;
}

export function RowShareIcon() {
  return <MaterialIcons name="share" size={22} color="#132A67" />;
}
