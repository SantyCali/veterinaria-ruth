import { View } from 'react-native';

import { Button, Card, Icon, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/lib/theme';

/** Se muestra a usuarios registrados que todavía no fueron aprobados (o fueron desactivados). */
export default function PendingScreen() {
  const { profile, signOut, refreshProfile } = useAuth();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg }}>
      <Card style={{ maxWidth: 440, width: '100%', gap: space.lg, alignItems: 'center' }}>
        <Icon name="account-clock-outline" size={48} color={colors.warning} />
        <Txt variant="h2" style={{ textAlign: 'center' }}>
          Cuenta pendiente de aprobación
        </Txt>
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          {profile?.email ? `${profile.email}: ` : ''}un administrador de la veterinaria tiene que
          activar tu usuario para que puedas ingresar.
        </Txt>
        <Button title="Volver a comprobar" icon="refresh" onPress={refreshProfile} />
        <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
      </Card>
    </View>
  );
}
