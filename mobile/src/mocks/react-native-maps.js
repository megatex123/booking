import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ style, children, ...props }) =>
  React.createElement(View, { style: [styles.map, style] }, [
    React.createElement(Text, { key: 'label', style: styles.label }, 'Map (web preview)'),
    children,
  ]);

const Marker = () => null;
const Callout = () => null;
const Circle = () => null;
const Polyline = () => null;

const styles = StyleSheet.create({
  map: { backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#666', fontSize: 14 },
});

MapView.Marker = Marker;
MapView.Callout = Callout;
MapView.Circle = Circle;
MapView.Polyline = Polyline;

export { Marker, Callout, Circle, Polyline };
export default MapView;
