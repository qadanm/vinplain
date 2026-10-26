import { useState } from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { recognizeVin } from 'expo-vin-ocr';

export default function App() {
  const [uri, setUri] = useState<string | null>(null);
  const [status, setStatus] = useState('No scan yet');

  async function scan() {
    const picked = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    setUri(asset.uri);
    setStatus('Reading…');

    const result = await recognizeVin(asset.uri);
    if (!result) {
      setStatus('No VIN found');
    } else if (result.checkDigitValid) {
      setStatus(`${result.vin} · check digit valid`);
    } else {
      setStatus(`${result.vin} · confirm this read`);
    }
  }

  return (
    <View style={styles.screen}>
      <Button title="Scan a VIN" onPress={scan} />
      <Text style={styles.status}>{status}</Text>
      {uri ? <Image source={{ uri }} style={styles.photo} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  status: { fontSize: 16 },
  photo: { width: '100%', height: 240, resizeMode: 'contain' },
});
