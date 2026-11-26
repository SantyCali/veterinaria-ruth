import { ScrollView, View } from 'react-native';

import { Card, Icon, Txt } from './ui';
import { colors, fonts, space } from '@/lib/theme';

/** Pantalla que aparece si falta el archivo .env con los datos de Supabase. */
export function SetupNeeded() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg }}>
      <Card style={{ maxWidth: 560, width: '100%', alignSelf: 'center', gap: space.md }}>
        <Icon name="database-cog-outline" size={40} color={colors.primary} />
        <Txt variant="h2">Falta conectar Supabase</Txt>
        <Txt variant="muted">
          Creá un archivo llamado .env en la raíz del proyecto (podés copiar .env.example) con estos
          dos datos de tu proyecto de Supabase (Project Settings → API):
        </Txt>
        <View style={{ backgroundColor: colors.surfaceAlt, padding: space.md, borderRadius: 8 }}>
          <Txt style={{ fontFamily: fonts.medium }}>EXPO_PUBLIC_SUPABASE_URL=...</Txt>
          <Txt style={{ fontFamily: fonts.medium }}>EXPO_PUBLIC_SUPABASE_ANON_KEY=...</Txt>
        </View>
        <Txt variant="small">Después reiniciá el servidor (npx expo start).</Txt>
      </Card>
    </ScrollView>
  );
}
