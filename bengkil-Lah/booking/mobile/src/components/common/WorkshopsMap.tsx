import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Workshop } from '../../types';

interface Props {
  workshops: Workshop[];
  userLocation: { lat: number; lng: number } | null;
  onPress: (w: Workshop) => void;
}

export const WorkshopsMap: React.FC<Props> = ({ workshops, userLocation, onPress }) => {
  const iframeRef = useRef<any>(null);
  const workshopMapRef = useRef<Record<string, Workshop>>({});

  const center = userLocation ?? { lat: 3.139, lng: 101.6869 };

  // Keep a map of id → workshop for click handling
  workshopMapRef.current = Object.fromEntries(workshops.map((w) => [w.id, w]));

  const markers = workshops.map((w) => ({
    id: w.id,
    lat: w.latitude,
    lng: w.longitude,
    name: w.workshop_name,
    rating: w.rating,
    distance: w.distance_km,
    is_open: w.is_open,
  }));

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%}
.pname{font-weight:700;font-size:13px;margin-bottom:4px;font-family:sans-serif}
.pmeta{font-size:11px;color:#666;margin-bottom:8px;font-family:sans-serif}
.pbtn{display:block;width:100%;background:#1E8BC3;color:#fff;border:none;border-radius:6px;padding:6px 0;cursor:pointer;font-size:12px;font-weight:600;font-family:sans-serif}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:true}).setView([${center.lat},${center.lng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom:19
}).addTo(map);

${userLocation ? `
L.circleMarker([${userLocation.lat},${userLocation.lng}],{
  radius:9,fillColor:'#EA4335',fillOpacity:1,color:'#fff',weight:3,
  className:''
}).addTo(map).bindPopup('<b style="font-family:sans-serif">You are here</b>');
` : ''}

var workshops=${JSON.stringify(markers)};
workshops.forEach(function(w){
  var color=w.is_open?'#1E8BC3':'#9CA3AF';
  var icon=L.divIcon({
    className:'',
    html:'<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:'+color+';border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>',
    iconSize:[26,26],iconAnchor:[13,26],popupAnchor:[0,-28]
  });
  var dist=w.distance!=null?' · '+w.distance.toFixed(1)+' km':'';
  var statusHtml=w.is_open?'<span style="color:#2E7D32;font-weight:700">Open</span>':'<span style="color:#c0392b;font-weight:700">Closed</span>';
  var el=document.createElement('div');
  el.innerHTML='<div class="pname">'+w.name+'</div>'
    +'<div class="pmeta">⭐ '+w.rating.toFixed(1)+dist+' · '+statusHtml+'</div>'
    +'<button class="pbtn" data-id="'+w.id+'">View & Book</button>';
  el.querySelector('button').addEventListener('click',function(){
    window.parent.postMessage({type:'workshopPress',id:w.id},'*');
  });
  L.marker([w.lat,w.lng],{icon:icon}).addTo(map).bindPopup(el);
});
</script>
</body>
</html>`;

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'workshopPress') {
        const w = workshopMapRef.current[e.data.id];
        if (w) onPress(w);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPress]);

  // Use string tag so metro doesn't try to resolve 'iframe' as a component
  const IFrame = 'iframe' as any;

  return (
    <View style={styles.wrap}>
      <IFrame
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
});
