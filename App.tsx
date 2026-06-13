import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { createAppDependencies } from './src/composition/createAppDependencies';
import { IconGalleryScreen } from './src/presentation/screens/IconGalleryScreen';
import { styles, SYSTEM_BAR_COLOR } from './src/presentation/screens/App.styles';
import { StartupLoadingScreen } from './src/presentation/components/StartupLoadingScreen';

function App() {
  const dependencies = useMemo(() => createAppDependencies(), []);
  const [isBooting, setIsBooting] = useState(true);
  const handleBootFinish = useCallback(() => setIsBooting(false), []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={SYSTEM_BAR_COLOR} />
      <SafeAreaView style={styles.container}>
        {isBooting ? (
          <StartupLoadingScreen onFinish={handleBootFinish} />
        ) : (
          <IconGalleryScreen
            getSystemIconsUseCase={dependencies.getSystemIconsUseCase}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
