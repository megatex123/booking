import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '../../utils/theme';

interface Props {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  height?: number;
}

export const LocationMap: React.FC<Props> = ({
  latitude,
  longitude,
  name,
  address,
  height = 220,
}) => {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:true,scrollWheelZoom:false})
  .setView([${latitude},${longitude}],16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom:19
}).addTo(map);

var icon=L.divIcon({
  className:'',
  html:'<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#1E8BC3;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>',
  iconSize:[32,32],iconAnchor:[16,32],popupAnchor:[0,-36]
});

L.marker([${latitude},${longitude}],{icon:icon})
  .addTo(map)
  .bindPopup('<b style="font-family:sans-serif;font-size:13px">${name.replace(/'/g, "\\'")}</b><br><span style="font-size:11px;color:#666;font-family:sans-serif">${address.replace(/'/g, "\\'")}</span>')
  .openPopup();
</script>
</body>
</html>`;

  const openDirections = () => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    );
  };

  const openInMaps = () => {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    );
  };

  const IFrame = 'iframe' as any;

  return (
    <View style={styles.container}>
      <View style={[styles.mapWrap, { height }]}>
        <IFrame
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={openDirections} activeOpacity={0.8}>
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={styles.btnPrimaryText}>Get Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={openInMaps} activeOpacity={0.8}>
          <Ionicons name="map-outline" size={16} color={Colors.primary} />
          <Text style={styles.btnSecondaryText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  mapWrap: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
  },
  btnPrimaryText: { ...Typography.button, color: '#fff', fontSize: 13 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  btnSecondaryText: { ...Typography.button, color: Colors.primary, fontSize: 13 },
});
