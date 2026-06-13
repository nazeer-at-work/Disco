import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SystemIconId } from '../../domain/entities/SystemIcon';

type DiscoIconProps = {
  id: SystemIconId;
  size?: number;
  hue: string;
};

function Dot({ size, color, style }: { size: number; color: string; style?: object }) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function DiscoIcon({ id, size = 56, hue }: DiscoIconProps) {
  const glyphSize = size * 0.62;

  return (
    <View
      style={[
        styles.shell,
        styles.shellSurface,
        {
          width: size,
          height: size,
          borderRadius: size * 0.35,
          shadowRadius: size * 0.16,
        },
      ]}
    >
      <View
        style={[
          styles.core,
          {
            width: glyphSize,
            height: glyphSize,
            borderRadius: glyphSize * 0.32,
            backgroundColor: hue,
          },
        ]}
      />
      <View
        style={[
          styles.highlight,
          {
            width: glyphSize * 0.55,
            height: glyphSize * 0.18,
            borderRadius: glyphSize * 0.2,
          },
        ]}
      />

      <View style={[styles.glyphLayer, { width: glyphSize, height: glyphSize }]}>
        {renderGlyph(id, glyphSize)}
      </View>
    </View>
  );
}

function renderGlyph(id: SystemIconId, size: number) {
  const stroke = Math.max(3, Math.round(size * 0.1));

  switch (id) {
    case 'phone':
      return (
        <View style={[styles.phoneArc, { width: size * 0.56, height: size * 0.56, borderWidth: stroke }]} />
      );
    case 'message':
      return (
        <>
          <View style={[styles.chatBubble, { width: size * 0.7, height: size * 0.52, borderRadius: size * 0.16 }]} />
          <View style={[styles.chatTail, { borderTopWidth: size * 0.12, borderLeftWidth: size * 0.1 }]} />
        </>
      );
    case 'contacts':
      return (
        <>
          <Dot size={size * 0.3} color="#13364D" style={{ top: size * 0.1 }} />
          <View style={[styles.userBody, { width: size * 0.56, height: size * 0.3, borderRadius: size * 0.16 }]} />
        </>
      );
    case 'clock':
      return (
        <>
          <View style={[styles.clockRing, { width: size * 0.72, height: size * 0.72, borderWidth: stroke }]} />
          <View style={[styles.clockHandLong, { height: size * 0.25, width: stroke * 0.75 }]} />
          <View style={[styles.clockHandShort, { width: size * 0.18, height: stroke * 0.75 }]} />
        </>
      );
    case 'files':
      return (
        <>
          <View style={[styles.folderTab, { width: size * 0.36, height: size * 0.16, borderTopLeftRadius: size * 0.08, borderTopRightRadius: size * 0.08 }]} />
          <View style={[styles.folderBody, { width: size * 0.74, height: size * 0.44, borderRadius: size * 0.12 }]} />
        </>
      );
    case 'yt-music':
      return (
        <>
          <View style={[styles.musicStem, { width: stroke, height: size * 0.46 }]} />
          <Dot size={size * 0.2} color="#13364D" style={{ bottom: size * 0.12, left: size * 0.28 }} />
          <Dot size={size * 0.2} color="#13364D" style={{ bottom: size * 0.2, left: size * 0.54 }} />
        </>
      );
    case 'settings':
      return (
        <>
          <View style={[styles.gearCore, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} />
          <View style={[styles.gearTooth, { width: size * 0.58, height: stroke }]} />
          <View style={[styles.gearTooth, { width: size * 0.58, height: stroke, transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.gearTooth, { width: size * 0.58, height: stroke, transform: [{ rotate: '90deg' }] }]} />
          <View style={[styles.gearTooth, { width: size * 0.58, height: stroke, transform: [{ rotate: '135deg' }] }]} />
        </>
      );
    case 'camera':
      return (
        <>
          <View style={[styles.cameraBody, { width: size * 0.74, height: size * 0.48, borderRadius: size * 0.12 }]} />
          <Dot size={size * 0.28} color="#FFFFFF" />
          <Dot size={size * 0.14} color="#13364D" />
        </>
      );
    case 'calendar':
      return (
        <>
          <View style={[styles.calendarBody, { width: size * 0.74, height: size * 0.54, borderRadius: size * 0.14 }]} />
          <View style={[styles.calendarTop, { width: size * 0.74, height: size * 0.14, borderTopLeftRadius: size * 0.14, borderTopRightRadius: size * 0.14 }]} />
          <Dot size={size * 0.08} color="#13364D" style={{ top: size * 0.08, left: size * 0.3 }} />
          <Dot size={size * 0.08} color="#13364D" style={{ top: size * 0.08, left: size * 0.44 }} />
        </>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  shellSurface: {
    backgroundColor: '#F4F5F7',
    shadowColor: '#8390A8',
    shadowOpacity: 0.24,
    elevation: 7,
  },
  core: {
    opacity: 0.98,
  },
  highlight: {
    position: 'absolute',
    top: '22%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '-18deg' }],
  },
  glyphLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
  },
  phoneArc: {
    borderColor: '#13364D',
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: 999,
    transform: [{ rotate: '14deg' }],
  },
  chatBubble: {
    backgroundColor: '#13364D',
  },
  chatTail: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    width: 0,
    height: 0,
    borderTopColor: '#13364D',
    borderLeftColor: 'transparent',
  },
  userBody: {
    position: 'absolute',
    bottom: 6,
    backgroundColor: '#13364D',
  },
  clockRing: {
    borderColor: '#13364D',
    borderRadius: 999,
  },
  clockHandLong: {
    position: 'absolute',
    backgroundColor: '#13364D',
    borderRadius: 999,
    bottom: '50%',
  },
  clockHandShort: {
    position: 'absolute',
    backgroundColor: '#13364D',
    borderRadius: 999,
    left: '50%',
  },
  folderTab: {
    position: 'absolute',
    top: 6,
    left: '22%',
    backgroundColor: '#13364D',
  },
  folderBody: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: '#13364D',
  },
  musicStem: {
    position: 'absolute',
    top: 9,
    right: 16,
    backgroundColor: '#13364D',
    borderRadius: 999,
  },
  gearCore: {
    backgroundColor: '#13364D',
  },
  gearTooth: {
    position: 'absolute',
    backgroundColor: '#13364D',
    borderRadius: 999,
  },
  cameraBody: {
    backgroundColor: '#13364D',
  },
  calendarBody: {
    backgroundColor: '#13364D',
  },
  calendarTop: {
    position: 'absolute',
    top: 7,
    backgroundColor: '#FFFFFF',
  },
});
