import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Avatar } from './ui';
import { speciesIcon } from '@/lib/labels';
import { PET_FILES_BUCKET, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { PetSpecies } from '@/lib/types';

// Las fotos están en un bucket privado: se muestran con links firmados que duran 1 hora.
// Se guardan en memoria para no pedir un link nuevo cada vez (y así la imagen queda en caché).

const TTL_MS = 55 * 60 * 1000;
const urls = new Map<string, { url: string; expires: number }>();
const pending = new Map<string, Promise<string | null>>();

function cached(path: string) {
  const hit = urls.get(path);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

async function signOne(path: string): Promise<string | null> {
  const hit = cached(path);
  if (hit) return hit;
  const inFlight = pending.get(path);
  if (inFlight) return inFlight;
  const p = supabase.storage
    .from(PET_FILES_BUCKET)
    .createSignedUrl(path, 3600)
    .then(({ data }) => {
      pending.delete(path);
      if (!data) return null;
      urls.set(path, { url: data.signedUrl, expires: Date.now() + TTL_MS });
      return data.signedUrl;
    });
  pending.set(path, p);
  return p;
}

/** Pide de una sola vez los links de muchas fotos (para grillas y listas). */
export async function prefetchPetPhotos(paths: (string | null | undefined)[]) {
  const missing = [...new Set(paths.filter((p): p is string => !!p && !cached(p) && !pending.has(p)))];
  if (missing.length === 0) return;
  const { data } = await supabase.storage.from(PET_FILES_BUCKET).createSignedUrls(missing, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      urls.set(item.path, { url: item.signedUrl, expires: Date.now() + TTL_MS });
    }
  }
}

/** Foto de la mascota, o el ícono de su especie si no tiene foto. */
export function PetAvatar({
  path,
  species,
  size = 40,
}: {
  path: string | null | undefined;
  species: PetSpecies;
  size?: number;
}) {
  // Se guarda junto con la ruta, así nunca se muestra la foto de otra mascota.
  const [signed, setSigned] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path || cached(path)) return;
    let alive = true;
    signOne(path).then((u) => {
      if (alive) setSigned({ path, url: u });
    });
    return () => {
      alive = false;
    };
  }, [path]);

  const shown = !path ? null : (cached(path) ?? (signed?.path === path ? signed.url : null));
  if (!shown) return <Avatar icon={speciesIcon[species]} size={size} />;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.primarySoft }}>
      <Image
        source={{ uri: shown }}
        style={{ width: size, height: size }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={path ?? undefined}
        accessibilityLabel="Foto de la mascota"
      />
    </View>
  );
}
