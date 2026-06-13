import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  CheckSquareIconProps,
  TabIconProps,
} from '../../screens/IconGalleryScreen.types';

export function HomeTabIcon({ active }: TabIconProps) {
  const color = active ? '#304AA0' : '#4B5567';
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M5.5 10.5L12 5.5L18.5 10.5V17.5C18.5 18.6 17.6 19.5 16.5 19.5H7.5C6.4 19.5 5.5 18.6 5.5 17.5V10.5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M10 19.5V14.4H14V19.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function SettingsTabIcon({ active }: TabIconProps) {
  const color = active ? '#304AA0' : '#4B5567';
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {active ? (
        <>
          <Path
            d="M12 4.5L18.4 8.2V15.8L12 19.5L5.6 15.8V8.2L12 4.5Z"
            fill="none"
            stroke={color}
            strokeWidth={1.9}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={2} fill={color} />
        </>
      ) : (
        <>
          <Path
            d="M12 4.8L18.1 8.3V15.7L12 19.2L5.9 15.7V8.3L12 4.8Z"
            stroke={color}
            strokeWidth={1.9}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={1.7} fill={color} />
        </>
      )}
    </Svg>
  );
}

export function CheckSquareIcon({ checked }: CheckSquareIconProps) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {checked ? (
        <>
          <Path
            d="M5 5H19V19H5V5Z"
            fill="#304AA0"
            stroke="#304AA0"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path
            d="M8.5 12.2L11 14.7L15.8 9.9"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <Path
          d="M5 5H19V19H5V5Z"
          fill="none"
          stroke="#9AA9C3"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}
